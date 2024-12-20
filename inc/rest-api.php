<?php
/**
 * REST API functionality for the WP AI Image Gen plugin.
 *
 * @package WP_AI_Image_Gen
 */

// Include the admin.php file to access wp_ai_image_gen_get_providers()
require_once plugin_dir_path(__FILE__) . 'admin.php';

// Include the file that contains wp_ai_image_gen_download_image() function
require_once plugin_dir_path(__FILE__) . 'image-functions.php';

// At the top of the file, after the opening PHP tag
require_once plugin_dir_path(__FILE__) . 'utils.php';

/**
 * Register the REST API route for generating images.
 *
 * @return void
 */
function wp_ai_image_gen_register_rest_route() {
    register_rest_route('wp-ai-image-gen/v1', '/generate-image/', [
        'methods'             => 'POST',
        'callback'            => 'wp_ai_image_gen_handle_request',
        'permission_callback' => function() { return current_user_can('edit_posts'); },
    ]);

    // Register the providers route.
    register_rest_route('wp-ai-image-gen/v1', '/providers', [
        'methods' => 'GET',
        'callback' => 'wp_ai_image_gen_get_providers_with_keys',
        'permission_callback' => function () {
            return current_user_can('edit_posts');
        }
    ]);
}
add_action('rest_api_init', 'wp_ai_image_gen_register_rest_route');

/**
 * Handles the request to generate an image.
 *
 * This function processes the incoming REST API request to generate an image using the specified provider and model.
 * If the model is not set in the request, it assigns a default model based on the selected provider.
 *
 * @param WP_REST_Request $request The request object containing parameters for image generation.
 * @return WP_REST_Response|WP_Error The response object with the generated image or a WP_Error on failure.
 */
function wp_ai_image_gen_handle_request($request) {
    // Retrieve the 'prompt' parameter from the request.
    $prompt = $request->get_param('prompt');
    // Retrieve the 'provider' parameter from the request.
    $provider = $request->get_param('provider');
    
    // Get all provider models from the options.
    $provider_models = get_option('wp_ai_image_gen_provider_models', []);
    
    // Define default models for each provider.
    $default_models = [
        'replicate' => 'black-forest-labs/flux-schnell',
        'openai'    => 'dall-e-3',
    ];

    // Retrieve the model for the given provider. If not set, assign the default model.
    if (isset($provider_models[$provider]) && !empty($provider_models[$provider])) {
        $model = $provider_models[$provider];
    } else {
        // Assign the default model based on the provider.
        if (isset($default_models[$provider])) {
            $model = $default_models[$provider];
            // Optionally, update the provider_models option with the default model.
            $provider_models[$provider] = $model;
            update_option('wp_ai_image_gen_provider_models', $provider_models);
            // Log that the default model has been set.
            wp_ai_image_gen_debug_log("No model set for provider {$provider}. Assigned default model: {$model}");
        } else {
            // If no default model is defined for the provider, set model as empty.
            $model = '';
            // Log that no default model is available for the provider.
            wp_ai_image_gen_debug_log("No model set and no default model available for provider {$provider}.");
        }
    }

    // Log the retrieved or default model for debugging purposes.
    wp_ai_image_gen_debug_log("Model for provider {$provider}: {$model}");

    // Set default values for additional parameters.
    $additional_params = [
        'num_outputs'    => 1,
        'aspect_ratio'   => '1:1',
        'output_format'  => 'webp',
        'output_quality' => 80
    ];
    
    // Override defaults with any provided parameters.
    foreach ($additional_params as $key => $default) {
        $value = $request->get_param($key);
        if ($value !== null) {
            $additional_params[$key] = $value;
        }
    }

    // Log the start of the image generation request.
    wp_ai_image_gen_debug_log("Starting image generation request");
    // Log the prompt, provider, and model being used.
    wp_ai_image_gen_debug_log("Prompt: $prompt, Provider: $provider, Model: $model");
    // Log the additional parameters in JSON format.
    wp_ai_image_gen_debug_log("Additional params: " . wp_json_encode($additional_params));

    // Set the maximum number of retry attempts.
    $max_retries = 3;
    // Initialize the retry count.
    $retry_count = 0;
    // Set the initial delay in seconds before retrying.
    $delay = 30; // Increased from 10 to 30 seconds

    // Loop to handle retries.
    while ($retry_count < $max_retries) {
        try {
            // Log the current attempt number and provider.
            wp_ai_image_gen_debug_log("Attempt " . ($retry_count + 1) . " - Making API request to $provider");
            // Make the API request to the selected provider.
            $response = wp_ai_image_gen_make_api_request($provider, $prompt, $model, $additional_params);
            
            // Check if the response is a WordPress error.
            if (is_wp_error($response)) {
                // Throw an exception with the error message.
                throw new Exception($response->get_error_message());
            }

            // Log that the API response is being handled.
            wp_ai_image_gen_debug_log("Handling API response");
            // Process the API response to retrieve the image URL.
            $image_url = wp_ai_image_gen_process_api_response($provider, $response);
            
            // If an image URL is successfully retrieved.
            if ($image_url) {
                // Log the successful image generation.
                wp_ai_image_gen_debug_log("Image generated successfully: $image_url");
                // Upload the generated image and return the response.
                return wp_ai_image_gen_upload_image($request, $image_url);
            } else {
                // Throw an exception if the image URL could not be extracted.
                throw new Exception("Failed to extract image URL from response");
            }
        } catch (Exception $e) {
            // Log the error message with the current attempt number.
            error_log("WP AI Image Gen: Error on attempt " . ($retry_count + 1) . ": " . $e->getMessage());
            // Increment the retry count.
            $retry_count++;

            // Check if the maximum number of retries has been reached.
            if ($retry_count >= $max_retries) {
                // Log that all retry attempts have been exhausted.
                error_log("WP AI Image Gen: All retry attempts exhausted");
                // Return a WP_Error indicating the failure to generate the image.
                return new WP_Error(
                    'api_error', 
                    'Failed to generate image after ' . $max_retries . ' attempts: ' . $e->getMessage(), 
                    ['status' => 500 ]
                );
            }

            // Implement exponential backoff by doubling the delay.
            $delay *= 2; // Increased backoff multiplier if needed.
            // Log the retry attempt and the delay before the next attempt.
            wp_ai_image_gen_debug_log("Retrying in $delay seconds...");
            // Pause execution for the specified delay duration.
            sleep($delay);
        }
    }
}

/**
 * Checks if the provided provider is valid.
 *
 * @param string $provider The provider to check.
 * @return bool True if the provider is valid, false otherwise.
 */
function wp_ai_image_gen_is_valid_provider($provider) {
    $valid_providers = wp_ai_image_gen_get_providers();
    return isset($valid_providers[$provider]);
}

/**
 * Retrieves the API key for the specified provider.
 *
 * @param string $provider The provider name.
 * @return string The API key.
 */
function wp_ai_image_gen_get_api_key($provider) {
    // Retrieve all provider API keys from the options.
    $provider_api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
    
    // Return the API key for the specified provider if it exists, otherwise return an empty string.
    return isset($provider_api_keys[$provider]) ? $provider_api_keys[$provider] : '';
}

/**
 * Makes the API request to the selected provider for image generation.
 *
 * This function handles API requests to different providers, with specific implementations for Replicate and OpenAI.
 * It now uses synchronous requests for both providers, eliminating the need for polling.
 *
 * @param string $provider The selected provider.
 * @param string $prompt The prompt for image generation.
 * @param string $model The selected model for image generation.
 * @param array $additional_params Additional parameters for the API request.
 * @return array|WP_Error The API response or WP_Error on failure.
 * @throws Exception If there's an error during the API request process.
 */
function wp_ai_image_gen_make_api_request($provider, $prompt, $model, $additional_params) {
    if ($provider === 'replicate') {
        // Retrieve the API key from the options.
        $api_key = wp_ai_image_gen_get_api_key('replicate');
        
        // Check if the API key is empty.
        if (empty($api_key)) {
            throw new Exception('Replicate API key is not set.');
        }

        $headers = [
            'Authorization' => 'Bearer ' . $api_key,
            'Content-Type' => 'application/json',
            'Prefer' => 'wait=60' // Use sync mode with a 60-second timeout.
        ];

        // Prepare the request body
        $body = [
            'input' => array_merge(
                [
                    'prompt' => $prompt,
                ],
                $additional_params
            )
        ];

        wp_ai_image_gen_debug_log("Sending request to Replicate API: " . wp_json_encode($body));
        $api_url = "https://api.replicate.com/v1/models/{$model}/predictions";
        wp_ai_image_gen_debug_log("API URL: " . $api_url);
        $response = wp_remote_post(
            $api_url,
            [
                'headers' => $headers,
                'body'    => wp_json_encode($body),
                'timeout' => 65 // Slightly longer than the Prefer wait time
            ]
        );

        if (is_wp_error($response)) {
            throw new Exception($response->get_error_message());
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if ( ! empty( $body['output'] )) {
            return $body;
        } else {
            // Add more detailed error logging here
            wp_ai_image_gen_debug_log("Replicate API error: " . wp_json_encode($body));
            throw new Exception('Prediction failed: ' . wp_json_encode($body));
        }
    }

    if ($provider === 'openai') {
        $api_key = wp_ai_image_gen_get_api_key('openai');
        
        if (empty($api_key)) {
            throw new Exception('OpenAI API key is not set.');
        }

        $headers = [
            'Authorization' => 'Bearer ' . $api_key,
            'Content-Type'  => 'application/json'
        ];

        /**
         * Prepare the request body for OpenAI.
         * Size defaults to 1024x1024.
         * Style defaults to vivid.
         */
        $body = [
            'prompt'            => $prompt,
            'n'                 => 1, // only 1 is supported for dall-e-3
            'response_format'   => 'url',
            'model'             => $model, // Include the selected model.
        ];

        // If the model is dall-e-3, use hd quality.
        if ('dall-e-3' === $model) {
            $body['quality'] = 'hd';
        }

        /**
         * @todo Add style support to the body array.
         * style
         * string or null
         * Optional
         * Defaults to vivid
         * The style of the generated images. 
         * Must be one of vivid or natural. 
         * Vivid causes the model to lean towards generating hyper-real and dramatic images. 
         * Natural causes the model to produce more natural, less hyper-real looking images. 
         * This param is only supported for dall-e-3.
         */

        wp_ai_image_gen_debug_log("Sending request to OpenAI API: " . wp_json_encode($body));

        $response = wp_remote_post(
            "https://api.openai.com/v1/images/generations",
            [
                'headers' => $headers,
                'body'    => wp_json_encode($body),
                'timeout' => 30
            ]
        );

        if (is_wp_error($response)) {
            throw new Exception($response->get_error_message());
        }

        $body = json_decode(wp_remote_retrieve_body($response), true);
        
        if (!isset($body['data'][0]['url'])) {
            throw new Exception('Failed to generate image: ' . wp_json_encode($body));
        }

        return [$body['data'][0]['url']];
    }

    // Implement other providers here.

    throw new Exception('Unsupported provider: ' . $provider);
}

/**
 * Processes the API response and retrieves the image URL or saves the image from a data URI.
 *
 * @param string $provider The provider name.
 * @param mixed  $response The API response.
 * @return string The image URL or path to the saved image file.
 * @throws Exception If processing fails.
 */
function wp_ai_image_gen_process_api_response($provider, $response) {
    // Log the provider being processed and the raw API response.
    wp_ai_image_gen_debug_log("Processing API response for provider: $provider");
    wp_ai_image_gen_debug_log("Response: " . wp_json_encode($response));

    if ($provider === 'replicate') {
        // Add more robust error checking and logging
        if (!is_array($response) || empty($response)) {
            wp_ai_image_gen_debug_log("Invalid Replicate response format: " . wp_json_encode($response));
            throw new Exception('Invalid response format from Replicate');
        }

        // Check if the output exists and is a data URI
        if ( ! empty( $response['output'] ) ) {
            $image_data = is_array( $response['output'] ) ? $response['output'][0] : $response['output'];
            // Check if the image_data is already a complete data URI
            if ( strpos( $image_data, 'data:' ) === 0) {
                // If it's a complete data URI, we can use it directly
                wp_ai_image_gen_debug_log( 'Received complete data URI from Replicate' );
                return wp_ai_image_gen_data_uri_to_image($image_data);
            } else {
                // If it's not a data URI, it might be a URL
                wp_ai_image_gen_debug_log( 'Received URL from Replicate: ' . $image_data );
                return $image_data;
            }
        }
    } elseif ( $provider === 'openai' ) {
        // Validate that the response is an array with one string (URI).
        if ( is_array( $response ) && count( $response ) === 1 && is_string( $response[0] ) ) {
            // Extract the image URL from the response array.
            $image_url = $response[0];
            // Log the extracted image URL.
            wp_ai_image_gen_debug_log( 'Extracted image URL: ' . $image_url );
            // Return the image URL.
            return $image_url;
        } else {
            // Log an error if the response format is invalid for OpenAI.
            error_log("WP AI Image Gen Error: Invalid response format from OpenAI");
            error_log("Expected an array with one string, got: " . wp_json_encode($response));
            // Throw an exception indicating the invalid response format.
            throw new Exception('Invalid response format from OpenAI');
        }
    }

    error_log("WP AI Image Gen Error: Unsupported provider - $provider");
    throw new Exception('Failed to process API response for provider: ' . $provider);
}

/**
 * Converts a data URI to an image file and returns its URL.
 *
 * @param string $data_uri The data URI containing the image data.
 * @return string The URL of the saved image file.
 * @throws Exception If the image cannot be saved.
 */
function wp_ai_image_gen_data_uri_to_image($data_uri) {
    // Log that we are converting a data URI to an image.
    wp_ai_image_gen_debug_log("Converting data URI to image: $data_uri");
    // Extract the image data and type from the data URI.
    $parts = explode(',', $data_uri, 2);
    if (count($parts) !== 2) {
        throw new Exception('Invalid data URI format.');
    }
    
    $image_data = base64_decode($parts[1]);
    $mime_type = explode(';', $parts[0])[0];
    $mime_type = str_replace('data:', '', $mime_type);

    // Determine the file extension based on the MIME type.
    $extension = '.png'; // Default to PNG
    if ($mime_type === 'image/jpeg') {
        $extension = '.jpg';
    } elseif ($mime_type === 'image/webp') {
        $extension = '.webp';
    }

    // Generate a unique filename.
    $filename = 'ai_generated_' . uniqid() . $extension;

    // Get the upload directory information.
    $upload_dir = wp_upload_dir();
    $file_path = $upload_dir['path'] . '/' . $filename;
    $file_url = $upload_dir['url'] . '/' . $filename;

    // Save the image file.
    if (file_put_contents($file_path, $image_data) === false) {
        throw new Exception('Failed to save the image file.');
    }

    // Update the file permissions if necessary.
    $stat = stat(dirname($file_path));
    $perms = $stat['mode'] & 0000666;
    chmod($file_path, $perms);

    wp_ai_image_gen_debug_log("Image saved to: $file_path");
    return $file_url;
}

/**
 * Retrieves the list of providers that have API keys set.
 *
 * @return WP_REST_Response The response containing providers with keys.
 */
function wp_ai_image_gen_get_providers_with_keys() {
    try {
        // Ensure the function to get providers exists.
        if (!function_exists('wp_ai_image_gen_get_providers')) {
            throw new Exception('Function wp_ai_image_gen_get_providers does not exist.');
        }

        $all_providers = wp_ai_image_gen_get_providers();
        
        // Check if we got a valid array of providers.
        if (!is_array($all_providers)) {
            throw new Exception('Invalid providers data returned.');
        }

        $provider_api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
        
        // Check if we got a valid array of API keys.
        if (!is_array($provider_api_keys)) {
            throw new Exception('Invalid API keys data returned.');
        }

        $providers_with_keys = array_filter($all_providers, function($provider_id) use ($provider_api_keys) {
            return !empty($provider_api_keys[$provider_id]);
        }, ARRAY_FILTER_USE_KEY);

        // Log successful execution.
        wp_ai_image_gen_debug_log('Successfully fetched providers with keys.');

        return new WP_REST_Response($providers_with_keys, 200);
    } catch (Exception $e) {
        // Log the error.
        error_log('WP AI Image Gen Error: ' . $e->getMessage());

        // Return an error response.
        return new WP_REST_Response(
            ['message' => 'An error occurred while fetching providers: ' . $e->getMessage()],
            500
        );
    }
}

