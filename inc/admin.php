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
		'WP AI Image Gen Settings', // Page title.
		'WP AI Image Gen',          // Menu title.
		'manage_options',           // Capability.
		'wp-ai-image-gen-settings', // Menu slug.
		'wp_ai_image_gen_render_settings_page' // Callback function.
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
	$provider_api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
	$migration_needed = false;

	// Check if OpenAI key exists in old format.
	$openai_key = get_option('wp_ai_image_gen_openai_api_key');
	if ($openai_key && !isset($provider_api_keys['openai'])) {
		$provider_api_keys['openai'] = $openai_key;
		$migration_needed = true;
	}

	// Update the option if migration was needed.
	if ($migration_needed) {
		update_option('wp_ai_image_gen_provider_api_keys', $provider_api_keys);
		delete_option('wp_ai_image_gen_openai_api_key');
	}
}
	
/**
 * Registers the settings for the plugin, including API keys and models.
 *
 * @return void
 */
function wp_ai_image_gen_register_settings() {
	// Migrate old options to new structure.
	wp_ai_image_gen_migrate_api_keys();

	// Register options for provider API keys.
	register_setting(
		'wp_ai_image_gen_settings',              // Option group.
		'wp_ai_image_gen_provider_api_keys',     // Option name.
		[
			'sanitize_callback' => 'wp_ai_image_gen_sanitize_provider_api_keys',
		]
	);

	// Register options for provider models.
	register_setting(
		'wp_ai_image_gen_settings',              // Option group.
		'wp_ai_image_gen_provider_models',       // Option name.
		[
			'sanitize_callback' => 'wp_ai_image_gen_sanitize_provider_models',
		]
	);

	// Add a settings section for API keys and models.
	add_settings_section(
		'wp_ai_image_gen_settings_section', // ID.
		'AI Image Providers',               // Title.
		'wp_ai_image_gen_providers_section_callback', // Callback.
		'wp-ai-image-gen-settings'          // Page.
	);

	// Get the list of providers.
	$providers = wp_ai_image_gen_get_providers();

	// Add a settings field for each provider's API key and model.
	foreach ($providers as $provider_id => $provider_name) {
		// API Key Field.
		add_settings_field(
			"wp_ai_image_gen_{$provider_id}_api_key",                       // ID.
			"{$provider_name} API Key",                                      // Title.
			'wp_ai_image_gen_api_key_callback',                             // Callback.
			'wp-ai-image-gen-settings',                                     // Page.
			'wp_ai_image_gen_settings_section',                             // Section.
			[
				'provider_id'   => $provider_id,
				'provider_name' => $provider_name,
			]
		);

		// Model Selection Field.
		add_settings_field(
			"wp_ai_image_gen_{$provider_id}_model",                          // ID.
			"{$provider_name} Model",                                         // Title.
			'wp_ai_image_gen_model_callback',                                 // Callback.
			'wp-ai-image-gen-settings',                                       // Page.
			'wp_ai_image_gen_settings_section',                               // Section.
			[
				'provider_id'   => $provider_id,
				'provider_name' => $provider_name,
				'models'        => wp_ai_image_gen_get_models_for_provider($provider_id), // Models array.
			]
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
	echo '<p>Enter the API keys and select the models for the AI image providers you want to use.</p>';
}

/**
 * Renders the API Key field for a provider.
 *
 * @param array $args Arguments passed to the callback.
 * @return void
 */
function wp_ai_image_gen_api_key_callback($args) {
    $provider_api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
    $provider_id = $args['provider_id'];
    $api_key = isset($provider_api_keys[$provider_id]) ? $provider_api_keys[$provider_id] : '';

    echo '<input type="text" id="wp_ai_image_gen_' . esc_attr($provider_id) . '_api_key" ';
    echo 'name="wp_ai_image_gen_provider_api_keys[' . esc_attr($provider_id) . ']" ';
    echo 'value="' . esc_attr($api_key) . '" size="40">';
    echo ' <button type="button" class="button wp-ai-image-gen-remove-key" data-provider="' . esc_attr($provider_id) . '">Remove</button>';
}

/**
 * Renders the Model Selection field for a provider.
 *
 * @param array $args Arguments passed to the callback.
 * @return void
 */
function wp_ai_image_gen_model_callback($args) {
    $provider_models = get_option('wp_ai_image_gen_provider_models', []);
    $provider_id = $args['provider_id'];
    $selected_model = isset($provider_models[$provider_id]) ? $provider_models[$provider_id] : '';
    $models = isset($args['models']) ? $args['models'] : [];

    if (empty($models)) {
        echo '<p>No models available for this provider.</p>';
        return;
    }

    echo '<select id="wp_ai_image_gen_' . esc_attr($provider_id) . '_model" ';
    echo 'name="wp_ai_image_gen_provider_models[' . esc_attr($provider_id) . ']" ';
    echo '>';
    echo '<option value="">Select a Model</option>';
    foreach ($models as $model_id => $model_name) {
        printf(
            '<option value="%s" %s>%s</option>',
            esc_attr($model_id),
            selected($selected_model, $model_id, false),
            esc_html($model_name)
        );
    }
    echo '</select>';
}

/**
 * Sanitizes the provider API keys before saving.
 *
 * @param array $input The input array of provider API keys.
 * @return array The sanitized array of provider API keys.
 */
function wp_ai_image_gen_sanitize_provider_api_keys($input) {
    $sanitized = [];
    $providers = wp_ai_image_gen_get_providers();
    
    // Iterate through all known providers.
    foreach ($providers as $provider_id => $provider_name) {
        // If the key exists in the input, sanitize it. If not, set it to an empty string.
        $sanitized[$provider_id] = isset($input[$provider_id]) ? sanitize_text_field(trim($input[$provider_id])) : '';
    }
    
    return $sanitized;
}

/**
 * Sanitizes the provider models before saving.
 *
 * @param array $input The input array of provider models.
 * @return array The sanitized array of provider models.
 */
function wp_ai_image_gen_sanitize_provider_models($input) {
    $sanitized = [];
    $providers = wp_ai_image_gen_get_providers();
    
    // Iterate through all known providers.
    foreach ($providers as $provider_id => $provider_name) {
        // If the model exists in the input and is valid, sanitize it. If not, set it to an empty string.
        $sanitized[$provider_id] = isset($input[$provider_id]) ? sanitize_text_field(trim($input[$provider_id])) : '';
    }
    
    return $sanitized;
}

/**
 * Retrieves the list of models for a given provider.
 *
 * @param string $provider_id The provider ID.
 * @return array An associative array of model IDs and names.
 */
function wp_ai_image_gen_get_models_for_provider($provider_id) {
    $models = [];

    switch ($provider_id) {
        case 'openai':
            $models = [
                'dall-e-2' => 'DALL-E 2',
                'dall-e-3' => 'DALL-E 3',
			];
            break;
        case 'replicate':
            $models = [
                'black-forest-labs/flux-schnell' => 'Flux Schnell by Black Forest Labs (low quality)',
				'black-forest-labs/flux-1.1-pro' => 'Flux 1.1 Pro by Black Forest Labs (high quality)',
			];
            break;
        // Add cases for more providers as needed.
        default:
            $models = [];
            break;
    }

    return $models;
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
	return [
		'openai'    => 'OpenAI',
		'replicate' => 'Replicate',
	];
}

/**
 * Load the script.
 */
function wp_ai_image_gen_enqueue_script() {
	wp_enqueue_script('wp-ai-image-gen', plugin_dir_url(__FILE__) . '../build/index.js', ['wp-blocks', 'wp-i18n', 'wp-editor'], '1.0.0', true);
}
add_action('admin_enqueue_scripts', 'wp_ai_image_gen_enqueue_script');
