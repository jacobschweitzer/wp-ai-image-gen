<?php
/**
 * OpenAI API provider implementation for WP AI Image Gen.
 *
 * @package WP_AI_Image_Gen
 */

class WP_AI_Image_Provider_OpenAI extends WP_AI_Image_Provider {
    /**
     * The base URL for the OpenAI API.
     */
    private const API_BASE_URL = 'https://api.openai.com/v1/images/generations';

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
     * Makes the API request to generate an image.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The API response or error.
     */
    public function make_api_request($prompt, $additional_params = []) {
        // Map aspect ratio to size
        $size = $this->map_aspect_ratio_to_size($additional_params['aspect_ratio'] ?? '1:1');

        // Prepare request body
        $body = [
            'model'           => $this->model,
            'prompt'          => $prompt,
            'n'               => min((int)($additional_params['num_outputs'] ?? 1), 1), // DALL-E 3 only supports 1 image
            'size'            => $size,
            'quality'         => ($additional_params['output_quality'] ?? 80) > 75 ? 'hd' : 'standard',
            'response_format' => 'url',
        ];

        // Log the request details
        wp_ai_image_gen_debug_log("Sending request to OpenAI API: " . wp_json_encode($body));

        // Make the API request
        $response = wp_remote_post(
            self::API_BASE_URL,
            [
                'headers' => $this->get_request_headers(),
                'body'    => wp_json_encode($body),
                'timeout' => 60,
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        return json_decode(wp_remote_retrieve_body($response), true);
    }

    /**
     * Processes the API response to extract the image URL.
     *
     * @param mixed $response The API response to process.
     * @return string|WP_Error The image URL or error.
     */
    public function process_api_response($response) {
        // Log the raw response for debugging
        wp_ai_image_gen_debug_log("Raw OpenAI response: " . wp_json_encode($response));

        // Check for error in response
        if (!empty($response['error'])) {
            wp_ai_image_gen_debug_log("OpenAI API error: " . wp_json_encode($response['error']));
            return new WP_Error(
                'openai_error',
                $response['error']['message'] ?? 'Unknown error occurred'
            );
        }

        // Check for valid response format
        if (empty($response['data']) || !is_array($response['data']) || empty($response['data'][0]['url'])) {
            wp_ai_image_gen_debug_log("Invalid OpenAI response format: " . wp_json_encode($response));
            return new WP_Error(
                'openai_error',
                'Invalid response format from OpenAI'
            );
        }

        // Extract and validate the URL
        $image_url = $response['data'][0]['url'];
        if (!filter_var($image_url, FILTER_VALIDATE_URL)) {
            wp_ai_image_gen_debug_log("Invalid URL in OpenAI response: " . $image_url);
            return new WP_Error(
                'openai_error',
                'Invalid image URL in response'
            );
        }

        wp_ai_image_gen_debug_log("Successfully extracted image URL from OpenAI: " . $image_url);
        return $image_url;
    }

    /**
     * Validates the API key format according to OpenAI's current standards.
     * OpenAI now supports multiple key formats: sk-proj-*, sk-None-*, and sk-svcacct-*.
     *
     * @return bool True if the API key matches any of the valid formats, false otherwise.
     */
    public function validate_api_key() {
        // Check if API key exists
        if (empty($this->api_key)) {
            return false;
        }

        // Check if the key starts with any of the valid prefixes
        $valid_prefixes = ['sk-proj-', 'sk-None-', 'sk-svcacct-', 'sk-'];
        
        foreach ($valid_prefixes as $prefix) {
            if (strpos($this->api_key, $prefix) === 0) {
                return true;
            }
        }

        return false;
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
}
