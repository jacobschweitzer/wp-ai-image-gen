<?php
/**
 * Plugin Name:       WP AI Image Gen
 * Description:       A plugin to generate images using AI.
 * Requires at least: 6.1
 * Requires PHP:      7.0
 * Version:           0.1.3
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
define( 'WP_AI_IMAGE_GEN_DEBUG_LOG', false );

// Load the admin page settings.
if ( is_admin() ) {
	require_once __DIR__ . '/inc/admin.php';
}

// Load the REST API functions.
require_once __DIR__ . '/inc/rest-api.php';

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
