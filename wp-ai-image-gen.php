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
define( 'WP_AI_IMAGE_GEN_DEBUG_LOG', false );

// Load the admin page settings.
if ( is_admin() ) {
	require_once __DIR__ . '/inc/admin.php';
}

require_once __DIR__ . '/inc/rest-api.php';

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
