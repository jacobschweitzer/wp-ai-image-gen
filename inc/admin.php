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
 * Migrates old API key options to the new structure.
 * This function should be called before registering settings.
 *
 * @return void
 */
function wp_ai_image_gen_migrate_api_keys() {
	$provider_api_keys = get_option('wp_ai_image_gen_provider_api_keys', array());
	$migration_needed = false;

	// Check if OpenAI key exists in old format
	$openai_key = get_option('wp_ai_image_gen_openai_api_key');
	if ($openai_key && !isset($provider_api_keys['openai'])) {
		$provider_api_keys['openai'] = $openai_key;
		$migration_needed = true;
	}

	// Check for additional providers in old format
	$additional_providers = get_option('wp_ai_image_gen_additional_providers', array());
	foreach ($additional_providers as $provider => $key) {
		if (!isset($provider_api_keys[$provider])) {
			$provider_api_keys[$provider] = $key;
			$migration_needed = true;
		}
	}

	// Update the option if migration was needed
	if ($migration_needed) {
		update_option('wp_ai_image_gen_provider_api_keys', $provider_api_keys);
		delete_option('wp_ai_image_gen_openai_api_key');
	}
}

/**
 * Registers the settings for the plugin.
 *
 * @return void
 */
function wp_ai_image_gen_register_settings() {
	// Migrate old options to new structure
	wp_ai_image_gen_migrate_api_keys();

	// Register a single option to store all provider API keys
	register_setting(
		'wp_ai_image_gen_settings',
		'wp_ai_image_gen_provider_api_keys',
		array(
			'sanitize_callback' => 'wp_ai_image_gen_sanitize_provider_api_keys',
		)
	);

	add_settings_section(
		'wp_ai_image_gen_settings_section',
		'AI Image Providers',
		'wp_ai_image_gen_providers_section_callback',
		'wp-ai-image-gen-settings'
	);

	// Get the list of providers
	$providers = wp_ai_image_gen_get_providers();

	// Add a settings field for each provider
	foreach ($providers as $provider_id => $provider_name) {
		add_settings_field(
			"wp_ai_image_gen_{$provider_id}_api_key",
				"{$provider_name} API Key",
			'wp_ai_image_gen_api_key_callback',
			'wp-ai-image-gen-settings',
			'wp_ai_image_gen_settings_section',
			array('provider_id' => $provider_id, 'provider_name' => $provider_name)
		);
	}
}
add_action('admin_init', 'wp_ai_image_gen_register_settings');

/**
 * Renders the providers section description.
 *
 * @return void
 */
function wp_ai_image_gen_providers_section_callback() {
	echo '<p>Enter the API keys for the AI image providers you want to use.</p>';
}

/**
 * Renders the API Key field for a provider.
 *
 * @param array $args Arguments passed to the callback.
 * @return void
 */
function wp_ai_image_gen_api_key_callback($args) {
    $provider_api_keys = get_option('wp_ai_image_gen_provider_api_keys', array());
    $provider_id = $args['provider_id'];
    $api_key = isset($provider_api_keys[$provider_id]) ? $provider_api_keys[$provider_id] : '';

    echo '<input type="text" id="wp_ai_image_gen_' . esc_attr($provider_id) . '_api_key" ';
    echo 'name="wp_ai_image_gen_provider_api_keys[' . esc_attr($provider_id) . ']" ';
    echo 'value="' . esc_attr($api_key) . '" size="40">';
    echo ' <button type="button" class="button wp-ai-image-gen-remove-key" data-provider="' . esc_attr($provider_id) . '">Remove</button>';
}

/**
 * Sanitizes the provider API keys before saving.
 *
 * @param array $input The input array of provider API keys.
 * @return array The sanitized array of provider API keys.
 */
function wp_ai_image_gen_sanitize_provider_api_keys($input) {
    $sanitized = array();
    $providers = wp_ai_image_gen_get_providers();
    
    // Iterate through all known providers.
    foreach ($providers as $provider_id => $provider_name) {
        // If the key exists in the input, sanitize it. If not, set it to an empty string.
        $sanitized[$provider_id] = isset($input[$provider_id]) ? trim($input[$provider_id]) : '';
    }
    
    return $sanitized;
}

/**
 * Adds JavaScript to the admin footer for API key removal functionality.
 * This script only loads on the WP AI Image Gen settings page.
 *
 * @return void
 */
function wp_ai_image_gen_admin_footer_js() {
    $screen = get_current_screen();
    if ($screen->id !== 'settings_page_wp-ai-image-gen-settings') {
        return;
    }
    ?>
    <script>
    document.addEventListener('DOMContentLoaded', function() {
        // Get all remove buttons.
        var removeButtons = document.querySelectorAll('.wp-ai-image-gen-remove-key');
        
        // Add click event listener to each remove button.
        removeButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                var providerId = this.getAttribute('data-provider');
                var inputField = document.getElementById('wp_ai_image_gen_' + providerId + '_api_key');
                if (inputField) {
                    inputField.value = '';
                }
            });
        });
    });
    </script>
    <?php
}
add_action('admin_footer', 'wp_ai_image_gen_admin_footer_js');

/**
 * Returns the list of supported AI image providers.
 *
 * @return array An associative array of provider IDs and names.
 */
function wp_ai_image_gen_get_providers() {
	return array(
		'openai' => 'OpenAI',
		'replicate' => 'Replicate',
		// Add more providers here as needed
	);
}

/**
 * Load the script.
 */
function wp_ai_image_gen_enqueue_script() {
	wp_enqueue_script('wp-ai-image-gen', plugin_dir_url(__FILE__) . '../build/index.js', array('wp-blocks', 'wp-i18n', 'wp-editor'), '1.0.0', true);
}
add_action('admin_enqueue_scripts', 'wp_ai_image_gen_enqueue_script');
