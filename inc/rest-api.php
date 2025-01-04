<?php
/**
 * REST API functionality for the WP AI Image Gen plugin.
 *
 * @package WP_AI_Image_Gen
 */
/**
 * Register the REST API route for generating images.
 *
 * @return void
 */
function wp_ai_image_gen_register_rest_route() {
    register_rest_route('wp-ai-image-gen/v1', '/generate-image', [
        'methods'             => 'POST',
        'callback'            => 'wp_ai_image_gen_handle_request',
        'permission_callback' => function() {
            return current_user_can('edit_posts');
        },
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
    if (!empty($provider_models[$provider])) {
        $model = $provider_models[$provider];
    } else {
        // Assign the default model based on the provider.
        if (! empty($default_models[$provider])) {
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

    if (empty($model)) {
        return new WP_Error(
            'model_not_set', 
            'No model set for provider: ' . $provider, 
            ['status' => 400]
        );
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
    $delay = 30;

    // Loop to handle retries.
    while ($retry_count < $max_retries) {
        try {
            // Log the current attempt number and provider.
            wp_ai_image_gen_debug_log("Attempt " . ($retry_count + 1) . " - Making API request to $provider");
            
            // Make the API request to generate the image
            $result = wp_ai_image_gen_make_api_request($provider, $prompt, $model, $additional_params);
            
            // If we got a successful result
            if (!is_wp_error($result)) {
                // Check if we have a valid URL and ID in the result
                if (isset($result['url']) && isset($result['id'])) {
                    wp_ai_image_gen_debug_log("Image generated successfully: " . wp_json_encode($result));
                    return new WP_REST_Response($result, 200);
                }
                // If we don't have the expected format, treat it as an error
                throw new Exception('Invalid response format: missing URL or ID');
            }
            
            // If we got a WP_Error, check if it's a temporary error that we should retry
            $error_code = $result->get_error_code();
            $error_data = $result->get_error_data();
            
            if ($error_code === 'replicate_pending') {
                // This is a temporary error, wait and retry
                wp_ai_image_gen_debug_log("Generation still in progress, waiting to retry...");
                
                // If we have a prediction ID, add it to the additional params for the next request
                if (!empty($error_data['prediction_id'])) {
                    wp_ai_image_gen_debug_log("Got prediction ID: " . $error_data['prediction_id']);
                    $additional_params['prediction_id'] = $error_data['prediction_id'];
                }
                
                sleep($delay);
                continue;
            }
            
            // For other errors, throw an exception to be caught below
            throw new Exception($result->get_error_message());

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
                    ['status' => 500]
                );
            }

            // Implement exponential backoff by doubling the delay.
            $delay *= 2;
            // Log the retry attempt and the delay before the next attempt.
            wp_ai_image_gen_debug_log("Retrying in $delay seconds...");
            // Pause execution for the specified delay duration.
            sleep($delay);
        }
    }
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
 * @param string $provider The selected provider.
 * @param string $prompt The prompt for image generation.
 * @param string $model The selected model for image generation.
 * @param array $additional_params Additional parameters for the API request.
 * @return array|WP_Error The API response or WP_Error on failure.
 * @throws Exception If there's an error during the API request process.
 */
function wp_ai_image_gen_make_api_request($provider, $prompt, $model, $additional_params) {
    // Get the provider instance
    $provider_instance = wp_ai_image_gen_provider_manager()->get_provider($provider);
    
    if (!$provider_instance) {
        throw new Exception('Invalid provider: ' . $provider);
    }

    // Get the API key for the provider
    $api_key = wp_ai_image_gen_get_api_key($provider);
    
    // Create a new instance with the API key and model
    $provider_instance = new $provider_instance($api_key, $model);
    
    // Generate the image
    $result = $provider_instance->generate_image($prompt, $additional_params);
    
    // Log the result for debugging
    wp_ai_image_gen_debug_log("Provider generation result: " . wp_json_encode($result));
    
    return $result;
}

/**
 * Retrieves the list of providers that have API keys set.
 *
 * @return WP_REST_Response The response containing providers with keys.
 */
function wp_ai_image_gen_get_providers_with_keys() {
    try {
        // Get the active providers.
        $providers_with_keys = wp_ai_image_gen_admin()->get_active_providers();

        // Log successful execution.
        wp_ai_image_gen_debug_log('Successfully fetched providers with keys.');

        // Return the array of provider IDs directly
        return new WP_REST_Response($providers_with_keys, 200);
    } catch (Exception $e) {
        // Log the error.
        error_log('WP AI Image Gen Error: ' . $e->getMessage());

        // Return an error response.
        return new WP_REST_Response(
            ['error' => 'An error occurred while fetching providers: ' . $e->getMessage()],
            500
        );
    }
}
