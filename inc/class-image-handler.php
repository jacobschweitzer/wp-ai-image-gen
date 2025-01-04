<?php
/**
 * Class for handling common image operations in WP AI Image Gen plugin.
 *
 * @package WP_AI_Image_Gen
 */
class WP_AI_Image_Handler {
    /**
     * Downloads an image from a given URL.
     *
     * @param string $url The URL of the image to download.
     * @return string|WP_Error The image data or WP_Error on failure.
     */
    public static function download_image($url) {
        wp_ai_image_gen_debug_log("Downloading image from URL: $url");

        $response = wp_remote_get($url, ['timeout' => 60]);

        if (is_wp_error($response)) {
            error_log("WP AI Image Gen Error: Error downloading image: " . $response->get_error_message());
            return $response;
        }

        $image_data = wp_remote_retrieve_body($response);

        if (empty($image_data)) {
            error_log("WP AI Image Gen Error: Downloaded image data is empty");
            return new WP_Error('empty_image', 'Downloaded image data is empty');
        }

        return $image_data;
    }

    /**
     * Uploads an image to the WordPress media library.
     *
     * @param string $image_data The raw image data or URL.
     * @param string $prompt The prompt used to generate the image (for alt text).
     * @return array|WP_Error Array containing the uploaded image URL and ID, or WP_Error on failure.
     */
    public static function upload_to_media_library($image_data, $prompt) {
        if (filter_var($image_data, FILTER_VALIDATE_URL)) {
            $image_data = self::download_image($image_data);
            if (is_wp_error($image_data)) {
                return $image_data;
            }
        }

        $filename = 'ai-generated-' . uniqid() . '.webp';
        $upload = wp_upload_bits($filename, null, $image_data);

        if ($upload['error']) {
            error_log("WP AI Image Gen Error: Error uploading image: " . $upload['error']);
            return new WP_Error('upload_error', $upload['error']);
        }

        if (!file_exists($upload['file']) || !is_readable($upload['file'])) {
            error_log("WP AI Image Gen Error: Uploaded file does not exist or is not readable");
            return new WP_Error('file_error', 'Uploaded file does not exist or is not readable');
        }

        $filetype = wp_check_filetype($filename, null);
        $attachment = [
            'post_mime_type' => $filetype['type'],
            'post_title'     => sanitize_file_name($filename),
            'post_content'   => '',
            'post_status'    => 'inherit',
            'post_excerpt'   => '',
        ];

        $attach_id = wp_insert_attachment($attachment, $upload['file']);

        if (is_wp_error($attach_id)) {
            error_log("WP AI Image Gen Error: Error inserting attachment: " . $attach_id->get_error_message());
            return $attach_id;
        }

        update_post_meta($attach_id, '_wp_attachment_image_alt', wp_strip_all_tags($prompt));

        require_once(ABSPATH . 'wp-admin/includes/image.php');
        $attach_data = wp_generate_attachment_metadata($attach_id, $upload['file']);
        wp_update_attachment_metadata($attach_id, $attach_data);

        return [
            'url' => wp_get_attachment_url($attach_id),
            'id' => $attach_id
        ];
    }

    /**
     * Converts a data URI to an image file and saves it.
     *
     * @param string $data_uri The data URI containing the image data.
     * @return string|WP_Error The URL of the saved image file or WP_Error on failure.
     */
    public static function data_uri_to_image($data_uri) {
        wp_ai_image_gen_debug_log("Converting data URI to image");
        
        $parts = explode(',', $data_uri, 2);
        if (count($parts) !== 2) {
            return new WP_Error('invalid_uri', 'Invalid data URI format.');
        }
        
        $image_data = base64_decode($parts[1]);
        $mime_type = explode(';', $parts[0])[0];
        $mime_type = str_replace('data:', '', $mime_type);

        $extension = '.png';
        if ($mime_type === 'image/jpeg') {
            $extension = '.jpg';
        } elseif ($mime_type === 'image/webp') {
            $extension = '.webp';
        }

        $filename = 'ai_generated_' . uniqid() . $extension;
        $upload_dir = wp_upload_dir();
        $file_path = trailingslashit($upload_dir['path']) . $filename;
        $file_url = trailingslashit($upload_dir['url']) . $filename;

        if (file_put_contents($file_path, $image_data) === false) {
            return new WP_Error('save_failed', 'Failed to save the image file.');
        }

        $stat = stat(dirname($file_path));
        $perms = $stat['mode'] & 0000666;
        chmod($file_path, $perms);

        return $file_url;
    }
} 