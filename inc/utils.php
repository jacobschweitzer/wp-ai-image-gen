<?php
/**
 * Utility functions for WP AI Image Gen plugin.
 *
 * @package WP_AI_Image_Gen
 */

/**
 * Logs debug information if WP_AI_IMAGE_GEN_DEBUG_LOG is set to true.
 *
 * @param string $message The debug message to log.
 * @return void
 */
function wp_ai_image_gen_debug_log($message) {
    if (defined('WP_AI_IMAGE_GEN_DEBUG_LOG') && WP_AI_IMAGE_GEN_DEBUG_LOG) {
        error_log("WP AI Image Gen Debug: " . $message);
    }
}
