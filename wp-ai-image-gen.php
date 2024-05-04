<?php
/**
 * Plugin Name:       WP AI Image Gen
 * Description:       A plugin to generate images using AI.
 * Requires at least: 6.1
 * Requires PHP:      7.0
 * Version:           0.1.0
 * Author:            Jacob Schweitzer
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-ai-image-gen
 *
 * @category Plugin
 * @package  WP_AI_Image_Gen
 * @author   Jacob Schweitzer <jacoballanschweitzer@gmail.com>
 * @license  GPL-2.0-or-later https://www.gnu.org/licenses/gpl-2.0.html
 * @link     https://jacobschweitzer.com/wp-ai-image-gen
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Set an debug log flag.
define( 'WP_AI_IMAGE_GEN_DEBUG_LOG', true );

// Load the admin page settings.
if ( is_admin() ) {
    require_once __DIR__ . '/inc/admin.php';
}

/**
 * Registers the block using the metadata loaded from the `block.json` file.
 * Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see    https://developer.wordpress.org/reference/functions/register_block_type/
 * @return void
 */
function create_block_wp_ai_image_gen_block_init() {
    register_block_type( __DIR__ . '/build' );
}
add_action( 'init', 'create_block_wp_ai_image_gen_block_init' );

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
    // Get the prompt from the request.
    $prompt = $request->get_param('prompt');

    // Your OpenAI API Key - store this securely, possibly in your wp-config.php.
    $api_key = get_option('wp_ai_image_gen_openai_api_key');

	// If the API key is not set, return an error.
	if ( empty( $api_key ) ) {
		return new WP_REST_Response( 'OpenAI API Key is not set.', 500);
	}

    // Prepare the API request.
    $response = wp_remote_post('https://api.openai.com/v1/images/generations', [
        'headers'     => [
            'Authorization' => 'Bearer ' . $api_key, // Add the API key to the headers.
            'Content-Type' => 'application/json', // Set the content type to JSON.
        ],
        'body'        => json_encode([
            'prompt' => $prompt, // Prompt for the image.
            'n'      => 1, // Number of images to generate.
            'size'   => '1024x1024', // Image size.
			'model'  => "dall-e-3", // Model to use.
        ]),
        'method'      => 'POST', // HTTP method.
        'data_format' => 'body', // Data format.
		'timeout'     => 30, // Increase the timeout to 30 seconds
    ]);

    // Check if the request was successful.
    if ( is_wp_error( $response ) ) {
        if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
            error_log( 'OpenAI API Request Error: ' . $response->get_error_message() );
        }
        return new WP_REST_Response( 'Error in API request: ' . $response->get_error_message(), 500 );
    }

    // Get the response code and body.
    $http_status = wp_remote_retrieve_response_code( $response );

    // Decode the body of the response.
    $body = json_decode( wp_remote_retrieve_body( $response ), true);

    // Check if the response was successful.
    if ( 200 !== $http_status ) {
        if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
            error_log('OpenAI API Response Error: ' . $body['error']['message']);
        }
        return new WP_REST_Response("Error in API response: " . $body['error']['message'], $http_status);
    }

    // Check if we have an image URL.
    if ( empty( $body['data'][0]['url'] ) ) {
        return new WP_REST_Response( 'Error in API response: ' . $body['error']['message'], $http_status );
    }

    // Get the image URL from the response.
	$image_url = $body['data'][0]['url'];

	// Download the image using wp_remote_get().
	$response = wp_remote_get( $image_url );
    if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
        error_log( 'Image Download Response: ' . print_r( $response, true ) );
    }

	// Log the MIME type of the downloaded image
	$mime_type = wp_remote_retrieve_header( $response, 'content-type' );
    if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
        error_log( 'Downloaded image MIME type: ' . $mime_type );
    }

	$extension = pathinfo( $image_url, PATHINFO_EXTENSION );
    if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
        error_log( 'File extension of downloaded image: ' . $extension );
    }

	if ( is_wp_error( $response ) ) {
        if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
            error_log( 'Error downloading image: ' . $response->get_error_message() );
        }
		return new WP_REST_Response( 'Error downloading image', 500 );
	}

    // Get the image data from the body of the response.
	$image_data = wp_remote_retrieve_body( $response );

	// Adjust the filename if necessary.
	// Extract the filename from the URL, removing any query parameters.
    $parsed_url = parse_url($image_url);
    $path_parts = pathinfo($parsed_url['path']);
    $filename = $path_parts['basename'];
    if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
        error_log( 'Filename of downloaded image: ' . $filename );
    }

     // Create a temporary file.
	$tmp_file_path = tmpfile();

    // Write the image data to the temporary file.
    fwrite( $tmp_file_path, $image_data );

    // Get the path of the temporary file.
    $file_path = stream_get_meta_data( $tmp_file_path )['uri'];

    // Include the media and file libraries so we can use media_handle_sideload().
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    // Handle the file using media_handle_sideload.
	$upload_id = media_handle_sideload( [
		'name'     => $filename,
		'type'     => $mime_type,
		'tmp_name' => $file_path,
		'size'     => filesize( $file_path ),
		'error'    => 0,
    ], 0 );

    // Check if media_handle_sideload returned a WP_Error.
    if ( is_wp_error( $upload_id ) ) {
        if ( WP_AI_IMAGE_GEN_DEBUG_LOG ) {
            error_log( 'Error uploading image: ' . $upload_id->get_error_message() );
        }
        return new WP_REST_Response( 'Error uploading image: ' . $upload_id->get_error_message(), 500 );
    }

    // Delete the temporary file.
	fclose( $tmp_file_path );

	// Get the URL of the uploaded image.
	$image_url = wp_get_attachment_url( $upload_id );
    if ( ! $image_url ) {
        return new WP_REST_Response( 'Error uploading image', 500 );
    }

    // Return the URL of the uploaded image.
	return new WP_REST_Response(
        [
            'url' => $image_url,
        ],
        200
    );
}

/**
 * Allows the custom mime types.
 *
 * @param array $mime_types The mime types.
 * @return array The mime types.
 */
function wp_ai_image_gen_allow_custom_mime_types($mime_types){
    $mime_types['png'] = 'image/png';  // Adding .png if not allowed
    return $mime_types;
}
add_filter( 'upload_mimes', 'wp_ai_image_gen_allow_custom_mime_types', 1, 1 );
