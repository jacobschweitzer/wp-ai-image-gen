<?php
/**
 * REST API functionality for the WP AI Image Gen plugin.
 *
 * @package WP_AI_Image_Gen
 */

/**
 * Handles all REST API endpoints and functionality for the plugin.
 */
final class WP_AI_Image_Gen_REST_Controller {
    /**
     * Holds the singleton instance of this class.
     * @var WP_AI_Image_Gen_REST_Controller
     */
    private static $instance = null;

    /**
     * The REST API namespace for this plugin.
     * @var string
     */
    private const API_NAMESPACE = 'wp-ai-image-gen/v1';

    /**
     * Initialize the REST API functionality.
     */
    private function __construct() {
        $this->init_hooks();
    }

    /**
     * Gets the singleton instance of the REST controller.
     * @return WP_AI_Image_Gen_REST_Controller The singleton instance.
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Initialize WordPress hooks.
     */
    private function init_hooks() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    /**
     * Registers all REST API routes for the plugin.
     */
    public function register_routes() {
        // Register the image generation endpoint
        register_rest_route(self::API_NAMESPACE, '/generate-image', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_generate_request'],
            'permission_callback' => [$this, 'check_permission'],
        ]);

        // Register the providers endpoint
        register_rest_route(self::API_NAMESPACE, '/providers', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_providers_with_keys'],
            'permission_callback' => [$this, 'check_permission'],
        ]);
        
        // Register the image-to-image providers endpoint
        register_rest_route(self::API_NAMESPACE, '/image-to-image-providers', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_image_to_image_providers'],
            'permission_callback' => [$this, 'check_permission'],
        ]);
    }

    /**
     * Checks if the current user has permission to access the endpoints.
     * @return bool Whether the user has permission.
     */
    public function check_permission() {
        return current_user_can('edit_posts');
    }

    /**
     * Handles the request to generate an image.
     * @param WP_REST_Request $request The request object.
     * @return WP_REST_Response|WP_Error The response or error.
     */
    public function handle_generate_request($request) {
        // Get request parameters
        $prompt = $request->get_param('prompt');
        $provider_id = $request->get_param('provider');
        
        // Get provider model
        $model = $this->get_provider_model($provider_id);
        if (is_wp_error($model)) {
            return $model;
        }

        // Get additional parameters with defaults
        $additional_params = $this->get_additional_params($request);

        // Log request details
        $this->log_request_details($prompt, $provider_id, $model, $additional_params);

        // Handle retries for image generation
        return $this->handle_generation_with_retries($provider_id, $prompt, $model, $additional_params);
    }

    /**
     * Gets the model for a specific provider.
     * @param string $provider_id The provider ID.
     * @return string|WP_Error The model or error.
     */
    private function get_provider_model($provider_id) {
        $provider_models = get_option('wp_ai_image_gen_provider_models', []);
        $default_models = [
            'replicate' => 'black-forest-labs/flux-schnell',
            'openai'    => 'dall-e-3',
        ];

        if (!empty($provider_models[$provider_id])) {
            return $provider_models[$provider_id];
        }

        if (!empty($default_models[$provider_id])) {
            $model = $default_models[$provider_id];
            $provider_models[$provider_id] = $model;
            update_option('wp_ai_image_gen_provider_models', $provider_models);
            wp_ai_image_gen_debug_log("Assigned default model for {$provider_id}: {$model}");
            return $model;
        }

        return new WP_Error('model_not_set', "No model set for provider: {$provider_id}", ['status' => 400]);
    }

    /**
     * Gets additional parameters with defaults from the request.
     * @param WP_REST_Request $request The request object.
     * @return array The parameters.
     */
    private function get_additional_params($request) {
        // Get saved quality settings
        $quality_settings = get_option('wp_ai_image_gen_quality_settings', []);
        $quality_value = isset($quality_settings['quality']) && $quality_settings['quality'] === 'hd' ? 100 : 80;
        $style_value = isset($quality_settings['style']) ? $quality_settings['style'] : 'natural';
        
        $defaults = [
            'num_outputs'    => 1,
            'aspect_ratio'   => '1:1',
            'output_format'  => 'webp',
            'output_quality' => $quality_value
        ];
        
        // Only include style for non-GPT Image-1 models
        $provider_models = get_option('wp_ai_image_gen_provider_models', []);
        $model = $provider_models[$request->get_param('provider')] ?? '';
        
        if ($model !== 'gpt-image-1') {
            $defaults['style'] = $style_value;
        }

        $params = [];
        foreach ($defaults as $key => $default) {
            $params[$key] = $request->get_param($key) ?? $default;
        }

        // Add source image URL if provided (single or array)
        $source_image_url = $request->get_param('source_image_url');
        if (!empty($source_image_url)) {
            $params['source_image_url'] = $source_image_url;
        }
        
        // Add additional image URLs if provided (for multiple source images)
        $additional_image_urls = $request->get_param('additional_image_urls');
        if (!empty($additional_image_urls) && is_array($additional_image_urls)) {
            $params['additional_image_urls'] = $additional_image_urls;
        }
        
        // Add mask URL if provided (for inpainting)
        $mask_url = $request->get_param('mask_url');
        if (!empty($mask_url)) {
            $params['mask_url'] = $mask_url;
        }

        return $params;
    }

    /**
     * Handles image generation with retries and longer timeouts for slow providers.
     * @param string $provider_id The provider ID.
     * @param string $prompt The generation prompt.
     * @param string $model The model to use.
     * @param array $additional_params Additional parameters.
     * @return WP_REST_Response|WP_Error The response or error.
     */
    private function handle_generation_with_retries($provider_id, $prompt, $model, $additional_params) {
        $max_retries = 15;
        $retry_count = 0;
        $delay = 3;
        $max_delay = 20;

        while ($retry_count < $max_retries) {
            try {
                wp_ai_image_gen_debug_log("Attempt " . ($retry_count + 1) . " - Making API request");
                
                $result = $this->make_provider_request($provider_id, $prompt, $model, $additional_params);
                
                if (!is_wp_error($result)) {
                    // Handle failed status with content filtering error
                    if (isset($result['status']) && $result['status'] === 'failed') {
                        if (isset($result['error']) && strpos($result['error'], 'flagged by safety filters') !== false) {
                            wp_ai_image_gen_debug_log("Content filtered by provider safety system: " . $result['error']);
                            return new WP_Error(
                                'content_filtered',
                                'The image was flagged by the provider\'s safety filters. Please modify your prompt and try again.',
                                ['status' => 400]
                            );
                        }
                        
                        // Handle other failure cases
                        $error_message = isset($result['error']) ? $result['error'] : 'Unknown error occurred';
                        throw new Exception("Generation failed: " . $error_message);
                    }

                    // Check for completed status explicitly
                    if (isset($result['status']) && $result['status'] === 'completed' && isset($result['url']) && isset($result['id'])) {
                        wp_ai_image_gen_debug_log("Image generated successfully: " . wp_json_encode($result));
                        return new WP_REST_Response($result, 200);
                    }
                    
                    // If we have a URL but status isn't explicitly completed, consider it successful
                    if (isset($result['url']) && isset($result['id']) && !isset($result['status'])) {
                        wp_ai_image_gen_debug_log("Image generated successfully (implicit): " . wp_json_encode($result));
                        return new WP_REST_Response(array_merge($result, ['status' => 'completed']), 200);
                    }
                    
                    // Handle processing status
                    if (isset($result['status']) && ($result['status'] === 'processing' || $result['status'] === 'starting')) {
                        wp_ai_image_gen_debug_log("Image still processing with status: " . $result['status']);
                        throw new Exception('Image still processing');
                    }
                    
                    throw new Exception('Invalid response format or incomplete generation');
                }

                // Handle content moderation errors (400) - return immediately without retrying
                if ($result->get_error_code() === 'content_moderation') {
                    wp_ai_image_gen_debug_log("Content moderation error - not retrying: " . $result->get_error_message());
                    return $result;
                }

                // Handle pending status
                if ($result->get_error_code() === 'replicate_pending' || 
                    $result->get_error_code() === 'processing') {
                    $error_data = $result->get_error_data();
                    if (!empty($error_data['prediction_id'])) {
                        $additional_params['prediction_id'] = $error_data['prediction_id'];
                    }
                    sleep((int)$delay);
                    $delay = min($delay * 1.5, $max_delay);
                    continue;
                }

                throw new Exception($result->get_error_message());

            } catch (Exception $e) {
                $retry_count++;
                wp_ai_image_gen_debug_log("Attempt {$retry_count} failed: " . $e->getMessage());
                
                if ($retry_count >= $max_retries) {
                    return new WP_Error(
                        'api_error',
                        'Failed after ' . $max_retries . ' attempts: ' . $e->getMessage(),
                        ['status' => 500]
                    );
                }
                
                $delay = min($delay * 1.5, $max_delay);
                sleep((int)$delay);
            }
        }
    }

    /**
     * Makes the request to the provider.
     * @param string $provider_id The provider ID.
     * @param string $prompt The generation prompt.
     * @param string $model The model to use.
     * @param array $additional_params Additional parameters.
     * @return array|WP_Error The result or error.
     */
    private function make_provider_request($provider_id, $prompt, $model, $additional_params) {
        $provider = wp_ai_image_gen_provider_manager()->get_provider($provider_id);
        if (!$provider) {
            return new WP_Error('invalid_provider', "Invalid provider: {$provider_id}");
        }

        // Get API keys from options
        $api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
        $api_key = isset($api_keys[$provider_id]) ? $api_keys[$provider_id] : '';
        
        $provider = new $provider($api_key, $model);
        
        return $provider->generate_image($prompt, $additional_params);
    }

    /**
     * Gets the list of providers with API keys.
     * @return WP_REST_Response The response containing providers.
     */
    public function get_providers_with_keys() {
        try {
            $providers = wp_ai_image_gen_admin()->get_active_providers();
            wp_ai_image_gen_debug_log('Successfully fetched providers with keys.');
            return new WP_REST_Response($providers, 200);
        } catch (Exception $e) {
            error_log('WP AI Image Gen Error: ' . $e->getMessage());
            return new WP_REST_Response(
                ['error' => 'Error fetching providers: ' . $e->getMessage()],
                500
            );
        }
    }
    
    /**
     * Gets the list of providers that support image-to-image generation.
     * @return WP_REST_Response The response containing providers that support image-to-image.
     */
    public function get_image_to_image_providers() {
        try {
            $image_to_image_providers = wp_ai_image_gen_provider_manager()->get_image_to_image_providers();
            wp_ai_image_gen_debug_log('Successfully fetched image-to-image providers: ' . wp_json_encode($image_to_image_providers));
            return new WP_REST_Response($image_to_image_providers, 200);
        } catch (Exception $e) {
            error_log('WP AI Image Gen Error: ' . $e->getMessage());
            return new WP_REST_Response(
                ['error' => 'Error fetching image-to-image providers: ' . $e->getMessage()],
                500
            );
        }
    }

    /**
     * Logs request details for debugging.
     * @param string $prompt The generation prompt.
     * @param string $provider_id The provider ID.
     * @param string $model The model being used.
     * @param array $additional_params Additional parameters.
     */
    private function log_request_details($prompt, $provider_id, $model, $additional_params) {
        wp_ai_image_gen_debug_log("Starting image generation request");
        wp_ai_image_gen_debug_log("Prompt: {$prompt}, Provider: {$provider_id}, Model: {$model}");
        
        // Create a copy of additional params for logging to prevent logging full image URLs
        $log_params = $additional_params;
        if (isset($log_params['source_image_url'])) {
            $log_params['source_image_url'] = '(source image URL provided)';
        }
        
        wp_ai_image_gen_debug_log("Additional params: " . wp_json_encode($log_params));
    }
}

/**
 * Gets the singleton instance of the REST controller.
 * @return WP_AI_Image_Gen_REST_Controller The REST controller instance.
 */
function wp_ai_image_gen_rest_controller() {
    return WP_AI_Image_Gen_REST_Controller::get_instance();
}

// Initialize the REST controller
add_action('init', function() {
    wp_ai_image_gen_rest_controller();
}, 10);
