<?php
/**
 * Replicate API provider implementation for WP AI Image Gen.
 *
 * @package WP_AI_Image_Gen
 */

/**
 * This class handles image generation using the Replicate API service.
 */
class WP_AI_Image_Provider_Replicate extends WP_AI_Image_Provider {
    /**
     * The base URL for the Replicate API.
     */
    private const API_BASE_URL = 'https://api.replicate.com/v1/models/';

    /**
     * Gets the unique identifier for this provider.
     *
     * @return string The unique identifier for this provider.
     */
    public function get_id() {
        return 'replicate';
    }

    /**
     * Gets the display name for this provider.
     *
     * @return string The display name for this provider.
     */
    public function get_name() {
        return 'Replicate';
    }

    /**
     * Gets the request headers for the API request.
     * Uses sync mode with shorter timeout since data URLs are no longer supported.
     *
     * @return array The request headers.
     */
    protected function get_request_headers() {
        return [
            'Authorization' => 'Token ' . $this->api_key,
            'Content-Type'  => 'application/json',
            'Prefer'       => 'wait=10' // Shorter sync timeout since we only wait for URL
        ];
    }

    /**
     * Makes the API request to generate an image.
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The API response or error.
     */
    public function make_api_request($prompt, $additional_params = []) {
        // Handle polling mode if prediction_id exists
        if (!empty($additional_params['prediction_id'])) {
            return $this->check_prediction_status($additional_params['prediction_id']);
        }

        $headers = $this->get_request_headers();
        $body = [
            'input' => array_merge(
                ['prompt' => $prompt],
                $additional_params
            )
        ];

        wp_ai_image_gen_debug_log("Sending sync request to Replicate API: " . wp_json_encode($body));
        
        $api_url = self::API_BASE_URL . "{$this->model}/predictions";

        // Make initial request with shorter timeout since we're just waiting for the URL
        $response = wp_remote_post(
            $api_url,
            [
                'headers' => $headers,
                'body'    => wp_json_encode($body),
                'timeout' => 15, // Slightly longer than the Prefer: wait=10 header
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        wp_ai_image_gen_debug_log("Replicate API response: " . wp_json_encode($body));

        // If we got a completed prediction with output, return it immediately
        if (isset($body['status']) && $body['status'] === 'succeeded' && 
            !empty($body['output']) && is_array($body['output']) && 
            !empty($body['output'][0])) {
            return $body;
        }

        // If we have a prediction ID but it's not complete, return for polling
        if (isset($body['id'])) {
            return new WP_Error(
                'replicate_pending',
                'Image generation is in progress',
                ['prediction_id' => $body['id']]
            );
        }

        return new WP_Error('replicate_error', 'Failed to generate image');
    }

    /**
     * Checks the status of a prediction with optimized polling.
     * @param string $prediction_id The ID of the prediction to check.
     * @return array|WP_Error The prediction status or error.
     */
    private function check_prediction_status($prediction_id) {
        $url = "https://api.replicate.com/v1/predictions/{$prediction_id}";
        wp_ai_image_gen_debug_log("Checking prediction status: " . $url);

        $response = wp_remote_get(
            $url,
            [
                'headers' => array_merge(
                    $this->get_request_headers(),
                    ['Prefer' => 'wait=5'] // Shorter wait for status checks
                ),
                'timeout' => 8
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        wp_ai_image_gen_debug_log("Replicate API status response: " . wp_json_encode($body));

        // If we have a completed prediction with output, return it immediately
        if (isset($body['status']) && $body['status'] === 'succeeded' && 
            !empty($body['output']) && is_array($body['output']) && 
            !empty($body['output'][0])) {
            return $body;
        }

        // If still processing, return the pending error
        if (isset($body['id'])) {
            return new WP_Error(
                'replicate_pending',
                'Image generation is still processing',
                ['prediction_id' => $body['id']]
            );
        }

        return new WP_Error('replicate_error', 'Failed to check prediction status');
    }

    /**
     * Processes the API response to extract the image URL or data.
     *
     * @param mixed $response The API response to process.
     * @return string|WP_Error The image URL/data or error.
     */
    public function process_api_response($response) {
        wp_ai_image_gen_debug_log("Raw Replicate response: " . wp_json_encode($response));

        if (!is_array($response)) {
            return new WP_Error('replicate_error', 'Invalid response format from Replicate');
        }

        // Check for error in response
        if (!empty($response['error'])) {
            return new WP_Error('replicate_error', $response['error']);
        }

        // Check the prediction status
        $status = $response['status'] ?? 'unknown';
        wp_ai_image_gen_debug_log("Replicate prediction status: " . $status);

        // Only process completed predictions
        if ($status !== 'succeeded') {
            return new WP_Error(
                'replicate_pending',
                'Image generation is still processing',
                ['prediction_id' => $response['id']]
            );
        }

        if (empty($response['output'])) {
            return new WP_Error('replicate_error', 'No image data in completed response');
        }

        // Get the image data from the output
        $image_data = is_array($response['output']) ? $response['output'][0] : $response['output'];
        wp_ai_image_gen_debug_log('Extracted image data from Replicate: ' . $image_data);

        // Check if the image_data is a complete data URI
        if (strpos($image_data, 'data:') === 0) {
            wp_ai_image_gen_debug_log('Received complete data URI from Replicate');
            return WP_AI_Image_Handler::data_uri_to_image($image_data);
        } elseif (filter_var($image_data, FILTER_VALIDATE_URL)) {
            wp_ai_image_gen_debug_log('Received valid URL from Replicate: ' . $image_data);
            return $image_data;
        } else {
            wp_ai_image_gen_debug_log('Invalid image data format from Replicate: ' . $image_data);
            return new WP_Error('replicate_error', 'Invalid image data format in response');
        }
    }

    /**
     * Validates the API key format for Replicate.
     *
     * @return bool True if the API key is valid, false otherwise.
     */
    public function validate_api_key() {
        // Replicate API keys are typically 40 characters long
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
}
