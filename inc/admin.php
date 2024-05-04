<?php
/**
 * Contains the admin page settings.
 *
 * @package wp-ai-image-gen
 */

/**
 * Adds the settings page to the WordPress admin.
 *
 * @return void
 */
function wp_ai_image_gen_add_settings_page() {
	add_options_page(
		'WP AI Image Gen Settings',
		'WP AI Image Gen',
		'manage_options',
		'wp-ai-image-gen-settings',
		'wp_ai_image_gen_render_settings_page'
	);
}
add_action('admin_menu', 'wp_ai_image_gen_add_settings_page');

/**
 * Renders the settings page.
 *
 * @return void
 */
function wp_ai_image_gen_render_settings_page() {
	?>
	<div class="wrap">
		<h1>WP AI Image Gen Settings</h1>
		<form method="post" action="options.php">
			<?php
			settings_fields('wp_ai_image_gen_settings');
			do_settings_sections('wp-ai-image-gen-settings');
			submit_button();
			?>
		</form>
	</div>
	<?php
}

/**
 * Registers the settings for the plugin.
 *
 * @return void
 */
function wp_ai_image_gen_register_settings() {
	register_setting('wp_ai_image_gen_settings', 'wp_ai_image_gen_openai_api_key');
	add_settings_section(
		'wp_ai_image_gen_settings_section',
		'API Settings',
		null,
		'wp-ai-image-gen-settings'
	);
	add_settings_field(
		'wp_ai_image_gen_openai_api_key',
		'OpenAI API Key',
		'wp_ai_image_gen_openai_api_key_callback',
		'wp-ai-image-gen-settings',
		'wp_ai_image_gen_settings_section'
	);
}
add_action('admin_init', 'wp_ai_image_gen_register_settings');

/**
 * Renders the OpenAI API Key field.
 *
 * @return void
 */
function wp_ai_image_gen_openai_api_key_callback() {
	$api_key = get_option('wp_ai_image_gen_openai_api_key');
	echo '<input type="text" name="wp_ai_image_gen_openai_api_key" value="' . esc_attr($api_key) . '" size="40">';
}
