<?php
/**
 * Abstract class for image generation providers.
 *
 * @package wp-ai-image-gen
 */

abstract class WP_AI_Image_Provider {
    // This protected property stores the API key for the provider.
    protected $api_key;
    
    // This protected property stores the selected model for the provider.
    protected $model;

    /**
     * Constructor initializes the provider with API key and model.
     *
     * @param string $api_key The API key for the provider.
     * @param string $model The selected model for image generation.
     */
    public function __construct($api_key, $model) {
        $this->api_key = $api_key;
        $this->model = $model;
    }

    /**
     * Abstract method that must be implemented by each provider to generate images.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The generated image data or error.
     */
    abstract public function generate_image($prompt, $additional_params = []);

    /**
     * Abstract method to validate the API key format.
     *
     * @return bool True if the API key is valid, false otherwise.
     */
    abstract public function validate_api_key();

    /**
     * Abstract method to get available models for the provider.
     *
     * @return array List of available models.
     */
    abstract public function get_available_models();

    /**
     * Gets the current model being used by the provider.
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
        if (in_array($model, array_keys($this->get_available_models()))) {
            $this->model = $model;
            return true;
        }
        return false;
    }

    /**
     * Prepares the headers for API requests.
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
     * Validates common parameters for image generation.
     * Child classes should extend this method for provider-specific validation.
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

        if (empty($this->model)) {
            return new WP_Error('invalid_model', 'Model is not set');
        }

        if (!$this->validate_api_key()) {
            return new WP_Error('invalid_api_key_format', 'API key format is invalid');
        }

        return true;
    }
}
