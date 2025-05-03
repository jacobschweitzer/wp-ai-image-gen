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
        // Always use the generations endpoint
        $endpoint = self::API_BASE_URL;
        
        // Ultra simple implementation for GPT Image-1
        if ($this->model === 'gpt-image-1') {
            // Absolute minimal parameters following OpenAI docs
            $body = [
                'model'  => 'gpt-image-1',
                'prompt' => $prompt
            ];
            
            wp_ai_image_gen_debug_log("GPT Image-1 API request: " . wp_json_encode($body));
            
            // Make the API request with only the required parameters
            $response = wp_remote_post(
                $endpoint,
                [
                    'headers' => $this->get_request_headers(),
                    'body'    => wp_json_encode($body),
                    'timeout' => 120, // Allow up to 2 minutes for generation
                ]
            );
            
            if (is_wp_error($response)) {
                return $response;
            }
            
            $response_body = wp_remote_retrieve_body($response);
            $response_code = wp_remote_retrieve_response_code($response);
            
            // Log the response
            wp_ai_image_gen_debug_log("Response code: " . $response_code);
            wp_ai_image_gen_debug_log("Response body: " . $response_body);
            
            // Handle error responses
            if ($response_code >= 400) {
                wp_ai_image_gen_debug_log("Error response from OpenAI API: " . $response_body);
                $error_data = json_decode($response_body, true);
                
                if (is_array($error_data) && isset($error_data['error'])) {
                    $error_message = $error_data['error']['message'] ?? 'Unknown error';
                    return new WP_Error('openai_error', $error_message);
                }
                
                return new WP_Error('api_error', "API Error (HTTP $response_code): $response_body");
            }
            
            return json_decode($response_body, true);
        }
        
        // Handle DALL-E models
        $source_image_url = isset($additional_params['source_image_url']) ? $additional_params['source_image_url'] : null;
        
        // Handle DALL-E 2 image variations differently
        if ($this->model === 'dall-e-2' && $source_image_url) {
            return $this->make_image_variations_request($source_image_url, $additional_params);
        }
        
        // Standard request for DALL-E models
        $body = [
            'model'  => $this->model,
            'prompt' => $prompt,
            'n'      => 1,
        ];
        
        // Handle aspect ratio
        if (isset($additional_params['aspect_ratio'])) {
            list($width, $height) = $this->map_aspect_ratio_to_dimensions($additional_params['aspect_ratio'] ?? '1:1');
            $body['size'] = "{$width}x{$height}";
        }
        
        // Add quality if specified
        if (isset($additional_params['output_quality']) && $additional_params['output_quality'] > 75) {
            $body['quality'] = 'hd';
        }
        
        // Add style if specified for DALL-E 3
        if ($this->model === 'dall-e-3' && isset($additional_params['style']) && 
            in_array($additional_params['style'], ['natural', 'vivid'])) {
            $body['style'] = $additional_params['style'];
        }
        
        // Log the request body for debugging
        wp_ai_image_gen_debug_log("OpenAI API request: " . wp_json_encode($body));
        
        // Make the API request
        $response = wp_remote_post(
            $endpoint,
            [
                'headers' => $this->get_request_headers(),
                'body'    => wp_json_encode($body),
                'timeout' => 60,
            ]
        );
        
        if (is_wp_error($response)) {
            return $response;
        }
        
        $response_body = wp_remote_retrieve_body($response);
        $response_code = wp_remote_retrieve_response_code($response);
        
        // Log the response
        wp_ai_image_gen_debug_log("Response code: " . $response_code);
        wp_ai_image_gen_debug_log("Response body: " . $response_body);
        
        // Handle error responses
        if ($response_code >= 400) {
            wp_ai_image_gen_debug_log("Error response from OpenAI API: " . $response_body);
            $error_data = json_decode($response_body, true);
            
            if (is_array($error_data) && isset($error_data['error'])) {
                $error_message = $error_data['error']['message'] ?? 'Unknown error';
                return new WP_Error('openai_error', $error_message);
            }
            
            return new WP_Error('api_error', "API Error (HTTP $response_code): $response_body");
        }
        
        return json_decode($response_body, true);
    }
    
    // This method is no longer used - we have a simplified direct implementation
    private function make_minimal_request($prompt, $endpoint, $source_image_url = null) {
        // Just in case this is still called somewhere, delegate to the main method
        return $this->make_api_request($prompt);
    }
    
    /**
     * Makes an image variations API request for DALL-E 2.
     *
     * @param string $source_image_url URL of the source image.
     * @param array $additional_params Additional parameters.
     * @return array|WP_Error The API response or error.
     */
    private function make_image_variations_request($source_image_url, $additional_params) {
        $endpoint = 'https://api.openai.com/v1/images/variations';
        wp_ai_image_gen_debug_log("Preparing image variations request");
        
        // Download the source image
        $image_data = WP_AI_Image_Handler::download_image($source_image_url);
        if (is_wp_error($image_data)) {
            return $image_data;
        }
        
        // Prepare file for multipart form upload
        $temp_file = wp_tempnam('openai-image-variation-');
        file_put_contents($temp_file, $image_data);
        
        // Check image dimensions
        $image_info = getimagesize($temp_file);
        if (!$image_info) {
            @unlink($temp_file);
            return new WP_Error('invalid_image', 'Could not determine image dimensions or type');
        }
        
        // DALL-E 2 requires square images
        if ($image_info[0] !== $image_info[1]) {
            @unlink($temp_file);
            return new WP_Error(
                'invalid_image_dimensions',
                'Source image must be square for image variations. Please crop the image to a square first.'
            );
        }
        
        // Prepare multipart form data
        $boundary = wp_generate_password(24, false);
        $headers = $this->get_request_headers();
        $headers['Content-Type'] = 'multipart/form-data; boundary=' . $boundary;
        
        // Build the multipart body
        $body = '';
        
        // Add image file
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="image"; filename="image.png"' . "\r\n";
        $body .= 'Content-Type: image/png' . "\r\n\r\n";
        $body .= $image_data . "\r\n";
        
        // Add n parameter
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="n"' . "\r\n\r\n";
        $body .= "1\r\n";
        
        // Add size parameter
        $size = $this->map_aspect_ratio_to_size($additional_params['aspect_ratio'] ?? '1:1');
        $body .= '--' . $boundary . "\r\n";
        $body .= 'Content-Disposition: form-data; name="size"' . "\r\n\r\n";
        $body .= $size . "\r\n";
        
        // End of multipart data
        $body .= '--' . $boundary . '--';
        
        // Make the API request
        $response = wp_remote_post(
            $endpoint,
            [
                'headers' => $headers,
                'body'    => $body,
                'timeout' => 60,
            ]
        );
        
        // Clean up the temp file
        @unlink($temp_file);
        
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
            return new WP_Error('openai_error', $response['error']['message'] ?? 'Unknown error occurred');
        }

        // Check for valid response format
        if (empty($response['data']) || !is_array($response['data'])) {
            wp_ai_image_gen_debug_log("Invalid OpenAI response format: " . wp_json_encode($response));
            return new WP_Error('openai_error', 'Invalid response format from OpenAI');
        }

        // Check for either URL or b64_json in the first data item
        if (empty($response['data'][0]['url']) && empty($response['data'][0]['b64_json'])) {
            wp_ai_image_gen_debug_log("Missing URL or b64_json in OpenAI response: " . wp_json_encode($response['data'][0]));
            return new WP_Error('openai_error', 'Missing image data in OpenAI response');
        }

        // Get the image URL (prefer URL over b64_json)
        $image_url = '';
        if (!empty($response['data'][0]['url'])) {
            $image_url = $response['data'][0]['url'];
            
            // Validate URL format
            if (!filter_var($image_url, FILTER_VALIDATE_URL)) {
                wp_ai_image_gen_debug_log("Invalid URL in OpenAI response: " . $image_url);
                return new WP_Error('openai_error', 'Invalid image URL in response');
            }
        } else if (!empty($response['data'][0]['b64_json'])) {
            // Handle base64 encoded images
            $b64_json = $response['data'][0]['b64_json'];
            $image_data = base64_decode($b64_json);
            
            if (!$image_data) {
                wp_ai_image_gen_debug_log("Invalid base64 data in OpenAI response");
                return new WP_Error('openai_error', 'Invalid base64 image data in response');
            }
            
            // Create a temp file for the image
            $upload_dir = wp_upload_dir();
            $filename = 'ai-generated-' . uniqid() . '.png';
            $filepath = $upload_dir['path'] . '/' . $filename;
            $fileurl = $upload_dir['url'] . '/' . $filename;
            
            // Write the image data to the file
            if (file_put_contents($filepath, $image_data)) {
                $image_url = $fileurl;
            } else {
                wp_ai_image_gen_debug_log("Failed to save base64 image data to file");
                return new WP_Error('openai_error', 'Failed to save image data');
            }
        }

        // Return standardized response with a numeric ID that WordPress can handle
        $result = [
            'url' => $image_url,
            'id' => 0, // Use 0 as a placeholder, the actual ID will be set by upload_to_media_library
            'status' => 'completed'
        ];

        wp_ai_image_gen_debug_log("Successfully processed OpenAI response: " . wp_json_encode($result));
        return $result;
    }

    /**
     * Validates the API key format according to OpenAI's current standards.
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
            // Keep only GPT Image-1 model as requested
            'gpt-image-1' => 'GPT Image-1 (latest model)',
        ];
    }
    
    /**
     * Checks if this provider supports image-to-image generation with the current model.
     *
     * @return bool True if image-to-image is supported, false otherwise.
     */
    public function supports_image_to_image() {
        // For now, only support DALL-E 2 for image variations to ensure basic functionality
        // We'll enable GPT Image-1 for image-to-image once text-to-image is confirmed working
        return $this->model === 'dall-e-2';
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
     * Maps aspect ratio to width and height dimensions for GPT Image-1.
     *
     * @param string $aspect_ratio The desired aspect ratio.
     * @return array Array containing width and height as integers.
     */
    private function map_aspect_ratio_to_dimensions($aspect_ratio) {
        $dimensions = [
            '1:1'  => [1024, 1024],
            '16:9' => [1792, 1024],
            '9:16' => [1024, 1792],
            '4:3'  => [1344, 1024],
            '3:4'  => [1024, 1344],
        ];

        return $dimensions[$aspect_ratio] ?? [1024, 1024];
    }
}