<?php
/**
 * Plugin Name:       KaiGen Premium
 * Description:       Premium editorial image workflows for KaiGen.
 * Requires Plugins:  kaigen
 * Requires at least: 7.0
 * Requires PHP:      7.4
 * Version:           0.1.0
 * Author:            Jacob Schweitzer
 * License:           GPL-2.0-or-later
 * Text Domain:       kaigen-premium
 *
 * @package KaiGenPremium
 */

namespace KaiGenPremium;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KAIGEN_PREMIUM_VERSION', '0.1.0' );

/**
 * Enqueues the premium editor experience.
 *
 * @return void
 */
function enqueue_editor_assets() {
	$asset_file = __DIR__ . '/build/index.asset.php';
	$asset      = file_exists( $asset_file )
		? include $asset_file
		: [
			'dependencies' => [ 'wp-api-fetch', 'wp-blocks', 'wp-components', 'wp-data', 'wp-element' ],
			'version'      => KAIGEN_PREMIUM_VERSION,
		];

	wp_enqueue_script(
		'kaigen-premium-editor',
		plugins_url( 'build/index.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);

	wp_enqueue_style(
		'kaigen-premium-editor',
		plugins_url( 'assets/kaigen-premium.css', __FILE__ ),
		[ 'wp-components' ],
		KAIGEN_PREMIUM_VERSION
	);
}
add_action( 'enqueue_block_editor_assets', __NAMESPACE__ . '\\enqueue_editor_assets' );
