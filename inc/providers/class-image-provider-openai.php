<?php
/**
 * OpenAI API provider implementation for WP AI Image Gen.
 *
 * @package WP_AI_Image_Gen
 */

class WP_AI_Image_Provider_OpenAI implements WP_AI_Image_Provider_Interface {
    /**
     * The base URL for the OpenAI API.
     */
    private const API_BASE_URL = 'https://api.openai.com/v1/images/generations';

    /**
     * The API key for authentication.
     *
     * @var string
     */
    private $api_key;

    /**
     * The selected model for image generation.
     *
     * @var string
     */
    private $model;

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
        return 'openai';
    }

    /**
     * Gets the display name for this provider.
     *
     * @return string The display name for this provider.
     */
    public function get_name() {
        return 'OpenAI';
    }

    /**
     * Generates an image using the OpenAI API.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The generated image data or error.
     */
    public function generate_image($prompt, $additional_params = []) {
        // Validate parameters
        $validation = $this->validate_parameters($prompt, $additional_params);
        if (is_wp_error($validation)) {
            return $validation;
        }

        // Prepare request headers
        $headers = [
            'Authorization' => 'Bearer ' . $this->api_key,
            'Content-Type'  => 'application/json',
        ];

        // Map aspect ratio to size
        $size = $this->map_aspect_ratio_to_size($additional_params['aspect_ratio'] ?? '1:1');

        // Prepare request body
        $body = [
            'model' => $this->model,
            'prompt' => $prompt,
            'n' => min((int)($additional_params['num_outputs'] ?? 1), 1), // DALL-E 3 only supports 1 image
            'size' => $size,
            'quality' => ($additional_params['output_quality'] ?? 80) > 75 ? 'hd' : 'standard',
            'response_format' => 'url',
        ];

        // Log the request details
        wp_ai_image_gen_debug_log("Sending request to OpenAI API: " . wp_json_encode($body));

        // Make the API request
        $response = wp_remote_post(
            self::API_BASE_URL,
            [
                'headers' => $headers,
                'body'    => wp_json_encode($body),
                'timeout' => 60,
            ]
        );

        // Handle response
        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);

        if (empty($body['data'][0]['url'])) {
            wp_ai_image_gen_debug_log("OpenAI API error: " . wp_json_encode($body));
            return new WP_Error(
                'openai_error',
                isset($body['error']['message']) ? $body['error']['message'] : 'Unknown error occurred'
            );
        }

        // Return array with the image URL
        return [$body['data'][0]['url']];
    }

    /**
     * Maps aspect ratio to OpenAI's supported size formats.
     *
     * @param string $aspect_ratio The desired aspect ratio.
     * @return string The corresponding OpenAI size parameter.
     */
    private function map_aspect_ratio_to_size($aspect_ratio) {
        $sizes = [
            '1:1'  => '1024x1024',
            '16:9' => '1792x1024',
            '9:16' => '1024x1792',
            '4:3'  => '1344x1024',
            '3:4'  => '1024x1344',
        ];

        return $sizes[$aspect_ratio] ?? '1024x1024';
    }

    /**
     * Validates the API key format.
     *
     * @return bool True if the API key is valid, false otherwise.
     */
    public function validate_api_key() {
        // OpenAI API keys typically start with 'sk-' and are 51 characters long
        return !empty($this->api_key) && 
               strpos($this->api_key, 'sk-') === 0 && 
               strlen($this->api_key) === 51;
    }

    /**
     * Gets the available models for OpenAI.
     *
     * @return array List of available models.
     */
    public function get_available_models() {
        return [
            'dall-e-2' => 'DALL-E 2',
            'dall-e-3' => 'DALL-E 3',
        ];
    }

    /**
     * Gets the currently selected model.
     *
     * @return string The current model identifier.
     */
    public function get_current_model() {
        return $this->model;
    }

    /**
     * Sets a new model for the provider.
     *
     * @param string $model The new model identifier.
     * @return bool True if the model was successfully set, false otherwise.
     */
    public function set_model($model) {
        if (array_key_exists($model, $this->get_available_models())) {
            $this->model = $model;
            return true;
        }
        return false;
    }

    /**
     * Validates the parameters required for image generation.
     *
     * @param string $prompt The generation prompt.
     * @param array $additional_params Additional parameters.
     * @return true|WP_Error True if valid, WP_Error if invalid.
     */
    protected function validate_parameters($prompt, $additional_params = []) {
        if (empty($prompt)) {
            return new WP_Error('invalid_prompt', 'Prompt cannot be empty');
        }

        if (empty($this->api_key)) {
            return new WP_Error('invalid_api_key', 'API key is not set');
        }

        if (!$this->validate_api_key()) {
            return new WP_Error('invalid_api_key_format', 'Invalid API key format');
        }

        if (empty($this->model)) {
            return new WP_Error('invalid_model', 'Model is not set');
        }

        // Validate aspect ratio if provided
        if (!empty($additional_params['aspect_ratio'])) {
            $valid_ratios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
            if (!in_array($additional_params['aspect_ratio'], $valid_ratios)) {
                return new WP_Error(
                    'invalid_aspect_ratio',
                    'Invalid aspect ratio. Must be one of: ' . implode(', ', $valid_ratios)
                );
            }
        }

        // DALL-E 3 specific validations
        if ($this->model === 'dall-e-3') {
            if (isset($additional_params['num_outputs']) && $additional_params['num_outputs'] > 1) {
                return new WP_Error(
                    'invalid_num_outputs',
                    'DALL-E 3 only supports generating one image at a time'
                );
            }
        }

        return true;
    }
}
