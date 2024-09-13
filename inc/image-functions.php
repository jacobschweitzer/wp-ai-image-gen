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
 * @param string $image_url The URL of the image to download.
 * @return array|WP_Error An array containing the image data and file type, or WP_Error on failure.
 */
function wp_ai_image_gen_download_image($url) {
    wp_ai_image_gen_debug_log("Downloading image from URL: $url");

    $response = wp_remote_get($url, array('timeout' => 60));

    if (is_wp_error($response)) {
        error_log("WP AI Image Gen Error: Error downloading image: " . $response->get_error_message());
        return $response;
    }

    $image_data = wp_remote_retrieve_body($response);

    if (empty($image_data)) {
        error_log("WP AI Image Gen Error: Downloaded image data is empty");
        return new WP_Error('empty_image', 'Downloaded image data is empty');
    }

    wp_ai_image_gen_debug_log("Image downloaded successfully. Size: " . strlen($image_data) . " bytes");

    // Save raw image data to a file for inspection
    $raw_file = wp_upload_dir()['basedir'] . '/raw_image_data.webp';
    file_put_contents($raw_file, $image_data);
    wp_ai_image_gen_debug_log("Raw image data saved to: $raw_file");

    return $image_data;
}

/**
 * Uploads an image to the WordPress media library.
 *
 * @param array  $image_data An array containing the image data and file type.
 * @param string $image_url  The original URL of the image.
 * @return array|WP_Error An array containing the uploaded image URL and ID, or WP_Error on failure.
 */
function wp_ai_image_gen_upload_image($request, $image_url) {
    wp_ai_image_gen_debug_log("Attempting to upload image from URL: $image_url");

    // Download the image
    $image_data = wp_ai_image_gen_download_image($image_url);
    if (is_wp_error($image_data)) {
        error_log("WP AI Image Gen Error: Error downloading image: " . $image_data->get_error_message());
        return $image_data;
    }

    wp_ai_image_gen_debug_log("Image downloaded successfully. Size: " . strlen($image_data) . " bytes");

    // Generate a unique filename
    $filename = 'ai-generated-' . uniqid() . '.webp';

    // Upload the image to the media library
    $upload = wp_upload_bits($filename, null, $image_data);

    if ($upload['error']) {
        error_log("WP AI Image Gen Error: Error uploading image: " . $upload['error']);
        return new WP_Error('upload_error', $upload['error']);
    }

    wp_ai_image_gen_debug_log("Image uploaded successfully. Path: " . $upload['file']);

    // Check if the file exists and is readable
    if (!file_exists($upload['file']) || !is_readable($upload['file'])) {
        error_log("WP AI Image Gen Error: Uploaded file does not exist or is not readable");
        return new WP_Error('file_error', 'Uploaded file does not exist or is not readable');
    }

    // Get file info
    $filetype = wp_check_filetype($filename, null);
    wp_ai_image_gen_debug_log("File type: " . json_encode($filetype));

    // Check file size
    $filesize = filesize($upload['file']);
    wp_ai_image_gen_debug_log("File size: $filesize bytes");

    // Prepare the attachment
    
    
    $attachment = [
        'post_mime_type' => $filetype['type'],
        'post_title'     => sanitize_file_name($filename), // @todo - add an ai generated title to the post title
        'post_content'   => '',
        'post_status'    => 'inherit',
        'post_excerpt'   => '', // @todo - add an ai generated caption to the post content
    ];

    // Insert the attachment
    $attach_id = wp_insert_attachment($attachment, $upload['file']);

    if (is_wp_error($attach_id)) {
        error_log("WP AI Image Gen Error: Error inserting attachment: " . $attach_id->get_error_message());
        return $attach_id;
    }

    wp_ai_image_gen_debug_log("Attachment inserted successfully. ID: $attach_id");

    // Set only the alt text
    update_post_meta($attach_id, '_wp_attachment_image_alt', wp_strip_all_tags($request->get_param('prompt')));

    // Generate attachment metadata
    require_once(ABSPATH . 'wp-admin/includes/image.php');
    $attach_data = wp_generate_attachment_metadata($attach_id, $upload['file']);
    
    if (is_wp_error($attach_data)) {
        error_log("WP AI Image Gen Error: Error generating attachment metadata: " . $attach_data->get_error_message());
        return $attach_data;
    }
    
    wp_ai_image_gen_debug_log("Attachment metadata: " . json_encode($attach_data));
    
    wp_update_attachment_metadata($attach_id, $attach_data);

    // Get the attachment URL
    $attachment_url = wp_get_attachment_url($attach_id);

    wp_ai_image_gen_debug_log("Image process completed. Attachment URL: $attachment_url");

    return new WP_REST_Response(array(
        'url' => $attachment_url,
        'id' => $attach_id
    ), 200);
}
