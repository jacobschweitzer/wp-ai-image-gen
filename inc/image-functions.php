<?php
/**
 * Functions for handling image operations in WP AI Image Gen plugin.
 *
 * @package WP_AI_Image_Gen
 */

require_once plugin_dir_path(__FILE__) . 'utils.php';

/**
 * Downloads an image from a given URL.
 *
 * This function retrieves the image data from the specified URL and saves the raw image data using WordPress filesystem methods.
 *
 * @param string $url The URL of the image to download.
 * @return array|WP_Error An array containing the image data and file type, or WP_Error on failure.
 */
function wp_ai_image_gen_download_image($url) {
    // Log the start of the image download process with the provided URL.
    wp_ai_image_gen_debug_log("Downloading image from URL: $url");

    // Make a remote GET request to fetch the image data with a 60-second timeout.
    $response = wp_remote_get($url, ['timeout' => 60]);

    // Check if the response contains a WordPress error.
    if (is_wp_error($response)) {
        // Log the error message and return the WP_Error object.
        error_log("WP AI Image Gen Error: Error downloading image: " . $response->get_error_message());
        return $response;
    }

    // Retrieve the body of the response, which contains the image data.
    $image_data = wp_remote_retrieve_body($response);

    // Check if the retrieved image data is empty.
    if (empty($image_data)) {
        // Log the error and return a new WP_Error indicating empty image data.
        error_log("WP AI Image Gen Error: Downloaded image data is empty");
        return new WP_Error('empty_image', 'Downloaded image data is empty');
    }

    // Log the successful download and the size of the image data in bytes.
    wp_ai_image_gen_debug_log("Image downloaded successfully. Size: " . strlen($image_data) . " bytes");

    // Initialize the WordPress filesystem to use WP_Filesystem methods.
    if ( ! function_exists( 'WP_Filesystem' ) ) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
    }
    WP_Filesystem();

    // Access the global WordPress filesystem object.
    global $wp_filesystem;

    // Retrieve the upload directory information.
    $upload_dir = wp_upload_dir();

    // Define the path to save the raw image data using the WP_Filesystem.
    $raw_file = trailingslashit( $upload_dir['basedir'] ) . 'raw_image_data.webp';

    // Save the raw image data to the specified file path using WP_Filesystem's put_contents method.
    $wp_filesystem->put_contents( $raw_file, $image_data, FS_CHMOD_FILE );

    // Log the successful saving of raw image data.
    wp_ai_image_gen_debug_log("Raw image data saved to: $raw_file");

    // Return the image data.
    return $image_data;
}

/**
 * Uploads an image to the WordPress media library.
 *
 * This function downloads an image from a URL, uploads it to the media library, and processes it for attachment.
 *
 * @param array  $request    The request data containing parameters.
 * @param string $image_url  The original URL of the image.
 * @return array|WP_Error An array containing the uploaded image URL and ID, or WP_Error on failure.
 */
function wp_ai_image_gen_upload_image($request, $image_url) {
    // Log the attempt to upload an image from the given URL.
    wp_ai_image_gen_debug_log("Attempting to upload image from URL: $image_url");

    // Download the image using the download function.
    $image_data = wp_ai_image_gen_download_image($image_url);
    if (is_wp_error($image_data)) {
        // Log the download error and return the WP_Error object.
        error_log("WP AI Image Gen Error: Error downloading image: " . $image_data->get_error_message());
        return $image_data;
    }

    // Log the successful download and size of the image data.
    wp_ai_image_gen_debug_log("Image downloaded successfully. Size: " . strlen($image_data) . " bytes");

    // Generate a unique filename for the image.
    $filename = 'ai-generated-' . uniqid() . '.webp';

    // Upload the image data to the media library using WordPress's wp_upload_bits function.
    $upload = wp_upload_bits($filename, null, $image_data);

    // Check if there was an error during the upload process.
    if ($upload['error']) {
        // Log the upload error and return a new WP_Error.
        error_log("WP AI Image Gen Error: Error uploading image: " . $upload['error']);
        return new WP_Error('upload_error', $upload['error']);
    }

    // Log the successful upload and the file path of the uploaded image.
    wp_ai_image_gen_debug_log("Image uploaded successfully. Path: " . $upload['file']);

    // Check if the uploaded file exists and is readable.
    if (!file_exists($upload['file']) || !is_readable($upload['file'])) {
        // Log the file error and return a new WP_Error.
        error_log("WP AI Image Gen Error: Uploaded file does not exist or is not readable");
        return new WP_Error('file_error', 'Uploaded file does not exist or is not readable');
    }

    // Retrieve the file type information of the uploaded image.
    $filetype = wp_check_filetype($filename, null);
    wp_ai_image_gen_debug_log("File type: " . wp_json_encode($filetype));

    // Determine the size of the uploaded file.
    $filesize = filesize($upload['file']);
    wp_ai_image_gen_debug_log("File size: $filesize bytes");

    // Prepare the attachment data for insertion into the media library.
    $attachment = [
        'post_mime_type' => $filetype['type'],
        'post_title'     => sanitize_file_name($filename), // @todo - add an ai generated title to the post title
        'post_content'   => '',
        'post_status'    => 'inherit',
        'post_excerpt'   => '', // @todo - add an ai generated caption to the post content
    ];

    // Insert the attachment into the WordPress media library.
    $attach_id = wp_insert_attachment($attachment, $upload['file']);

    // Check if there was an error inserting the attachment.
    if (is_wp_error($attach_id)) {
        // Log the attachment insertion error and return the WP_Error object.
        error_log("WP AI Image Gen Error: Error inserting attachment: " . $attach_id->get_error_message());
        return $attach_id;
    }

    // Log the successful insertion of the attachment with its ID.
    wp_ai_image_gen_debug_log("Attachment inserted successfully. ID: $attach_id");

    // Update the attachment's alt text meta data with the sanitized prompt parameter.
    update_post_meta($attach_id, '_wp_attachment_image_alt', wp_strip_all_tags($request->get_param('prompt')));

    // Include the image.php file for image metadata functions.
    require_once(ABSPATH . 'wp-admin/includes/image.php');

    // Generate attachment metadata for the uploaded image.
    $attach_data = wp_generate_attachment_metadata($attach_id, $upload['file']);
    
    // Check if there was an error generating the attachment metadata.
    if (is_wp_error($attach_data)) {
        // Log the metadata generation error and return the WP_Error object.
        error_log("WP AI Image Gen Error: Error generating attachment metadata: " . $attach_data->get_error_message());
        return $attach_data;
    }
    
    // Log the generated attachment metadata.
    wp_ai_image_gen_debug_log("Attachment metadata: " . wp_json_encode($attach_data));
    
    // Update the attachment with the generated metadata.
    wp_update_attachment_metadata($attach_id, $attach_data);

    // Retrieve the URL of the attached image.
    $attachment_url = wp_get_attachment_url($attach_id);

    // Log the completion of the image processing with the attachment URL.
    wp_ai_image_gen_debug_log("Image process completed. Attachment URL: $attachment_url");

    // Return the attachment URL and ID as a successful REST response.
    return new WP_REST_Response([
        'url' => $attachment_url,
        'id' => $attach_id
    ], 200);
}