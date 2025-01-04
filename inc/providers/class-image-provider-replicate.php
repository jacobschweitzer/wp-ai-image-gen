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
     *
     * @return array The request headers.
     */
    protected function get_request_headers() {
        return [
            'Authorization' => 'Token ' . $this->api_key,
            'Content-Type'  => 'application/json',
            'Prefer'        => 'wait=60' // Enable sync mode
        ];
    }

    /**
     * Makes the API request to generate an image.
     *
     * @param string $prompt The text prompt for image generation.
     * @param array $additional_params Additional parameters for image generation.
     * @return array|WP_Error The API response or error.
     */
    public function make_api_request($prompt, $additional_params = []) {
        // Check if we have a prediction ID in the additional params
        if (!empty($additional_params['prediction_id'])) {
            return $this->check_prediction_status($additional_params['prediction_id']);
        }

        // If no prediction ID, start a new prediction
        // Prepare the request headers
        $headers = $this->get_request_headers();

        // Prepare the request body
        $body = [
            'input' => array_merge(
                ['prompt' => $prompt],
                $additional_params
            )
        ];

        // Log the request details
        wp_ai_image_gen_debug_log("Sending request to Replicate API: " . wp_json_encode($body));
        
        // Build the API URL with the selected model
        $api_url = self::API_BASE_URL . "{$this->model}/predictions";
        wp_ai_image_gen_debug_log("API URL: " . $api_url);

        // Make the API request
        $response = wp_remote_post(
            $api_url,
            [
                'headers' => $headers,
                'body'    => wp_json_encode($body),
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        // Log the response for debugging
        wp_ai_image_gen_debug_log("Replicate API response: " . wp_json_encode($response));

        return json_decode(wp_remote_retrieve_body($response), true);
    }

    /**
     * Checks the status of a prediction.
     *
     * @param string $prediction_id The ID of the prediction to check.
     * @return array|WP_Error The prediction status or error.
     */
    private function check_prediction_status($prediction_id) {
        $url = "https://api.replicate.com/v1/predictions/{$prediction_id}";
        wp_ai_image_gen_debug_log("Checking prediction status: " . $url);

        $response = wp_remote_get(
            $url,
            [
                'headers' => $this->get_request_headers(),
                'timeout' => 30
            ]
        );

        if (is_wp_error($response)) {
            return $response;
        }

        wp_ai_image_gen_debug_log("Replicate API response: " . wp_json_encode($response));

        return json_decode(wp_remote_retrieve_body($response), true);
    }

    /**
     * Processes the API response to extract the image URL or data.
     *
     * @param mixed $response The API response to process.
     * @return string|WP_Error The image URL/data or error.
     */
    public function process_api_response($response) {
        // Log the raw response for debugging
        wp_ai_image_gen_debug_log("Raw Replicate response: " . wp_json_encode($response));

        // Add more robust error checking and logging
        if (!is_array($response)) {
            wp_ai_image_gen_debug_log("Invalid Replicate response format (not an array): " . wp_json_encode($response));
            return new WP_Error('replicate_error', 'Invalid response format from Replicate');
        }

        // Check for error in response
        if (!empty($response['error'])) {
            wp_ai_image_gen_debug_log("Replicate API error: " . wp_json_encode($response['error']));
            return new WP_Error('replicate_error', $response['error']);
        }

        // Check the prediction status
        $status = $response['status'] ?? 'unknown';
        wp_ai_image_gen_debug_log("Replicate prediction status: " . $status);

        switch ($status) {
            case 'starting':
            case 'processing':
                // Return a special error with the prediction ID for retry
                return new WP_Error(
                    'replicate_pending',
                    'Image generation is still processing',
                    ['prediction_id' => $response['id']]
                );
            case 'succeeded':
            case 'successful':
                if (empty($response['output'])) {
                    wp_ai_image_gen_debug_log("No output in completed Replicate response: " . wp_json_encode($response));
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

            case 'failed':
                $error_message = $response['error'] ?? 'Image generation failed';
                wp_ai_image_gen_debug_log("Replicate generation failed: " . $error_message);
                return new WP_Error('replicate_failed', $error_message);

            default:
                wp_ai_image_gen_debug_log("Unknown Replicate status: " . $status);
                return new WP_Error('replicate_error', 'Unknown prediction status: ' . $status);
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
