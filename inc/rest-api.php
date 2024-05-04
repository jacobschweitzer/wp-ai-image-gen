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
	register_rest_route( 'wp-ai-image-gen/v1', '/generate-image/', [
		'methods'             => 'POST',
		'callback'            => 'wp_ai_image_gen_handle_request',
		'permission_callback' => function() { return user_can( get_current_user_id(), 'edit_posts' ); },
	] );
}
add_action( 'rest_api_init', 'wp_ai_image_gen_register_rest_route' );
/**
 * Handles the request to generate an image.
 *
 * @param WP_REST_Request $request The request object.
 *
 * @return WP_REST_Response The response object.
 */
function wp_ai_image_gen_handle_request( WP_REST_Request $request ) {
    // Get the prompt and API key
    $prompt = wp_ai_image_gen_get_prompt( $request );
    $api_key = wp_ai_image_gen_get_api_key();

    // If the API key is not set, return an error
    if ( empty( $api_key ) ) {
        return new WP_REST_Response( 'OpenAI API Key is not set.', 500 );
    }

    // Make the API request to OpenAI
    $response = wp_ai_image_gen_make_api_request( $prompt, $api_key );

    // Check if the request was successful
    if ( is_wp_error( $response ) ) {
        wp_ai_image_gen_log_error( 'OpenAI API Request Error: ' . $response->get_error_message() );
        return new WP_REST_Response( 'Error in API request: ' . $response->get_error_message(), 500 );
    }

    // Handle the API response
    $image_url = wp_ai_image_gen_handle_api_response( $response );

    // If there was an error in the API response, return an error
    if ( is_wp_error( $image_url ) ) {
        return new WP_REST_Response( 'Error in API response: ' . $image_url->get_error_message(), $image_url->get_error_code() );
    }

    // Download the generated image
    $image_data = wp_ai_image_gen_download_image( $image_url );

    // If there was an error downloading the image, return an error
    if ( is_wp_error( $image_data ) ) {
        wp_ai_image_gen_log_error( 'Error downloading image: ' . $image_data->get_error_message() );
        return new WP_REST_Response( 'Error downloading image', 500 );
    }

    // Upload the image to WordPress media library
    $upload_result = wp_ai_image_gen_upload_image( $image_data, $image_url );

    // If there was an error uploading the image, return an error
    if ( is_wp_error( $upload_result ) ) {
        wp_ai_image_gen_log_error( 'Error uploading image: ' . $upload_result->get_error_message() );
        return new WP_REST_Response( 'Error uploading image: ' . $upload_result->get_error_message(), 500 );
    }

    // Return the URL and ID of the uploaded image
    return new WP_REST_Response( $upload_result, 200 );
}

/**
 * Retrieves the prompt from the request.
 *
 * @param WP_REST_Request $request The request object.
 *
 * @return string The prompt.
 */
function wp_ai_image_gen_get_prompt( WP_REST_Request $request ) {
    return $request->get_param( 'prompt' );
}

/**
 * Retrieves the OpenAI API key from the WordPress options.
 *
 * @return string The API key.
 */
function wp_ai_image_gen_get_api_key() {
    return get_option( 'wp_ai_image_gen_openai_api_key' );
}

/**
 * Makes the API request to OpenAI for image generation.
 *
 * @param string $prompt  The prompt for image generation.
 * @param string $api_key The OpenAI API key.
 *
 * @return array|WP_Error The API response or WP_Error on failure.
 */
function wp_ai_image_gen_make_api_request( $prompt, $api_key ) {
    return wp_remote_post(
        'https://api.openai.com/v1/images/generations',
        [
            'headers'     => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
            ],
            'body'        => json_encode( [
                'prompt' => $prompt,
                'n'      => 1,
                'size'   => '1024x1024',
                'model'  => "dall-e-3",
            ] ),
            'method'      => 'POST',
            'data_format' => 'body',
            'timeout'     => 30,
        ]
    );
}

/**
 * Handles the API response and retrieves the image URL.
 *
 * @param array $response The API response.
 *
 * @return string|WP_Error The image URL or WP_Error on failure.
 */
function wp_ai_image_gen_handle_api_response( $response ) {
    $http_status = wp_remote_retrieve_response_code( $response );
    $body        = json_decode( wp_remote_retrieve_body( $response ), true );

    if ( 200 !== $http_status ) {
        wp_ai_image_gen_log_error( 'OpenAI API Response Error: ' . $body['error']['message'] );
        return new WP_Error( $http_status, $body['error']['message'] );
    }

    if ( empty( $body['data'][0]['url'] ) ) {
        return new WP_Error( 'invalid_response', 'Invalid API response' );
    }

    return $body['data'][0]['url'];
}

/**
 * Downloads the image from the given URL.
 *
 * @param string $image_url The URL of the image to download.
 *
 * @return string|WP_Error The image data or WP_Error on failure.
 */
function wp_ai_image_gen_download_image( $image_url ) {
    $response = wp_remote_get( $image_url );

    if ( is_wp_error( $response ) ) {
        return $response;
    }

    $mime_type = wp_remote_retrieve_header( $response, 'content-type' );
    $extension = pathinfo( $image_url, PATHINFO_EXTENSION );

    wp_ai_image_gen_log_debug( 'Downloaded image MIME type: ' . $mime_type );
    wp_ai_image_gen_log_debug( 'File extension of downloaded image: ' . $extension );

    return wp_remote_retrieve_body( $response );
}

/**
 * Uploads the image to the WordPress media library.
 *
 * @param string $image_data The image data.
 * @param string $image_url  The URL of the image.
 *
 * @return array|WP_Error The uploaded image data or WP_Error on failure.
 */
function wp_ai_image_gen_upload_image( $image_data, $image_url ) {
    $parsed_url  = parse_url( $image_url );
    $path_parts  = pathinfo( $parsed_url['path'] );
    $filename    = $path_parts['basename'];
    $tmp_file    = tmpfile();

    fwrite( $tmp_file, $image_data );
    $file_path   = stream_get_meta_data( $tmp_file )['uri'];

    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $upload_id   = media_handle_sideload( [
        'name'     => $filename,
        'type'     => mime_content_type( $file_path ),
        'tmp_name' => $file_path,
        'size'     => filesize( $file_path ),
        'error'    => 0,
    ], 0 );

    fclose( $tmp_file );

    if ( is_wp_error( $upload_id ) ) {
        return $upload_id;
    }

    $image_url = wp_get_attachment_url( $upload_id );

    if ( ! $image_url ) {
        return new WP_Error( 'upload_error', 'Error uploading image' );
    }

    return [
        'url' => $image_url,
        'id'  => $upload_id,
    ];
}

/**
 * Logs an error message if debug logging is enabled.
 *
 * @param string $message The error message to log.
 */
function wp_ai_image_gen_log_error( $message ) {
    if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
        error_log( $message );
    }
}

/**
 * Logs a debug message if debug logging is enabled.
 *
 * @param string $message The debug message to log.
 */
function wp_ai_image_gen_log_debug( $message ) {
    if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
        error_log( $message );
    }
}
