<?php
/**
 * Replicate API provider implementation for WP AI Image Gen.
 *
 * @package WP_AI_Image_Gen
 */

/**
 * This class handles image generation using the Replicate API service.
 */
class WP_AI_Image_Provider_Replicate implements WP_AI_Image_Provider_Interface {
    /**
     * The base URL for the Replicate API.
     */
    private const API_BASE_URL = 'https://api.replicate.com/v1/models/';

    /**
     * The selected model for image generation.
     *
     * @var string
     */
    private $model;

    /**
     * The API key for authentication.
     *
     * @var string
     */
    private $api_key;

    /**
     * Constructor initializes the provider with API key and model.
     *
     * @param string $api_key The API key for authentication.
     * @param string $model The selected model for image generation.
     */
    public function __construct($api_key, $model) {
        $this->api_key = $api_key;
        $this->model = $model;
    }

    /**
     * Gets the unique identifier for this provider.
     *
     * @return string The unique identifier for this provider.
     */
    public function get_id() {
        return 'replicate';
    }

    /**
     * Generates an image using the Replicate API.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The generated image data or error.
     */
    public function generate_image($prompt, $additional_params = []) {
        // Validate the parameters before proceeding.
        $validation = $this->validate_parameters($prompt, $additional_params);
        if (is_wp_error($validation)) {
            return $validation;
        }

        // Prepare the request headers with sync mode.
        $headers = array_merge(
            $this->get_request_headers(),
            ['Prefer' => 'wait=60'] // Use sync mode with a 60-second timeout
        );

        // Prepare the request body.
        $body = [
            'input' => array_merge(
                ['prompt' => $prompt],
                $additional_params
            )
        ];

        // Log the request details.
        wp_ai_image_gen_debug_log("Sending request to Replicate API: " . wp_json_encode($body));
        
        // Build the API URL with the selected model.
        $api_url = self::API_BASE_URL . "{$this->model}/predictions";
        wp_ai_image_gen_debug_log("API URL: " . $api_url);

        // Make the API request.
        $response = wp_remote_post(
            $api_url,
            [
                'headers' => $headers,
                'body'    => wp_json_encode($body),
                'timeout' => 65 // Slightly longer than the Prefer wait time
            ]
        );

        // Handle any request errors.
        if (is_wp_error($response)) {
            return $response;
        }

        // Parse the response body.
        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        // Check for successful output.
        if (!empty($body['output'])) {
            return $body;
        }

        // Log and return error if the response is invalid.
        wp_ai_image_gen_debug_log("Replicate API error: " . wp_json_encode($body));
        return new WP_Error('replicate_error', 'Prediction failed: ' . wp_json_encode($body));
    }

    /**
     * Validates the API key format for Replicate.
     *
     * @return bool True if the API key is valid, false otherwise.
     */
    public function validate_api_key() {
        // Replicate API keys are typically 40 characters long.
        return !empty($this->api_key) && strlen($this->api_key) === 40;
    }

    /**
     * Gets the available models for Replicate.
     *
     * @return array List of available models.
     */
    public function get_available_models() {
        return [
            'black-forest-labs/flux-schnell' => 'Flux Schnell by Black Forest Labs (low quality)',
            'black-forest-labs/flux-1.1-pro' => 'Flux 1.1 Pro by Black Forest Labs (high quality)',
            'recraft-ai/recraft-v3'          => 'Recraft V3 by Recraft AI (high quality)',
        ];
    }

    /**
     * Gets custom request headers for Replicate API.
     *
     * @return array The headers array for the API request.
     */
    protected function get_request_headers() {
        return [
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type' => 'application/json',
        ];
    }

    /**
     * Validates the parameters required for image generation with Replicate.
     *
     * @param string $prompt The generation prompt.
     * @param array $additional_params Additional parameters.
     * @return true|WP_Error True if valid, WP_Error if invalid.
     */
    protected function validate_parameters($prompt, $additional_params = []) {
        // Check that we have a prompt.
        if (empty($prompt)) {
            return new WP_Error('invalid_prompt', 'Prompt cannot be empty');
        }

        // Validate Replicate-specific parameters.
        if (!empty($additional_params)) {
            // Check if num_outputs is within acceptable range (1-4).
            if (isset($additional_params['num_outputs'])) {
                $num_outputs = intval($additional_params['num_outputs']);
                if ($num_outputs < 1 || $num_outputs > 4) {
                    return new WP_Error(
                        'invalid_num_outputs',
                        'Number of outputs must be between 1 and 4'
                    );
                }
            }

            // Validate aspect ratio if provided.
            if (isset($additional_params['aspect_ratio'])) {
                $valid_ratios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
                if (!in_array($additional_params['aspect_ratio'], $valid_ratios)) {
                    return new WP_Error(
                        'invalid_aspect_ratio',
                        'Invalid aspect ratio. Must be one of: ' . implode(', ', $valid_ratios)
                    );
                }
            }
        }

        return true;
    }

    /**
     * Gets the currently selected model for this provider.
     * This method returns the model identifier that is currently set for image generation.
     *
     * @return string The current model identifier.
     */
    public function get_current_model() {
        return $this->model;
    }

    /**
     * Sets a new model for the provider.
     * This method validates and sets a new model for image generation, ensuring it exists in the available models list.
     *
     * @param string $model The new model identifier to set.
     * @return bool True if the model was successfully set, false otherwise.
     */
    public function set_model($model) {
        $available_models = $this->get_available_models();
        if (array_key_exists($model, $available_models)) {
            $this->model = $model;
            return true;
        }
        return false;
    }

    /**
     * Gets the display name for this provider.
     *
     * @return string The display name for this provider.
     */
    public function get_name() {
        return 'Replicate';
    }
}
