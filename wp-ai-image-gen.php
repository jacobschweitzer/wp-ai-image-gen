<?php
/**
 * Plugin Name:       WP AI Image Gen
 * Description:       A plugin to generate images using AI.
 * Requires at least: 6.1
 * Requires PHP:      7.0
 * Version:           0.1.4
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

// Set a debug log flag.
define( 'WP_AI_IMAGE_GEN_DEBUG_LOG', true );

// Load utility functions first
require_once __DIR__ . '/inc/utils.php';

// Load base classes and interfaces
require_once __DIR__ . '/inc/class-image-handler.php';
require_once __DIR__ . '/inc/interface-image-provider.php';
require_once __DIR__ . '/inc/class-image-provider.php';

// Load provider manager and admin classes
require_once __DIR__ . '/inc/class-provider-manager.php';
require_once __DIR__ . '/inc/class-admin.php';

// Load REST API functionality
require_once __DIR__ . '/inc/rest-api.php';
