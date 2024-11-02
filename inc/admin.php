<?php
/**
 * Contains the admin page settings.
 *
 * @package wp-ai-image-gen
 */

// Load required files
require_once plugin_dir_path(__FILE__) . 'interface-image-provider.php';
require_once plugin_dir_path(__FILE__) . 'class-provider-manager.php';

/**
 * Handles all WordPress admin functionality for the AI Image Generator plugin.
 */
class WP_AI_Image_Gen_Admin {
	/**
	 * Holds the singleton instance of this class.
	 * @var WP_AI_Image_Gen_Admin
	 */
	private static $instance = null;

	/**
	 * Holds the provider manager instance.
	 * @var WP_AI_Image_Provider_Manager
	 */
	private $provider_manager;

	/**
	 * Initialize the admin functionality.
	 */
	private function __construct() {
		$this->provider_manager = WP_AI_Image_Provider_Manager::get_instance();
		$this->init_hooks();
	}

	/**
	 * Gets the singleton instance of the admin class.
	 * @return WP_AI_Image_Gen_Admin The singleton instance.
	 */
	public static function get_instance() {
		if (null === self::$instance) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Initialize WordPress hooks.
	 */
	private function init_hooks() {
		add_action('admin_menu', [$this, 'add_settings_page']);
		add_action('admin_init', [$this, 'register_settings']);
		add_action('admin_enqueue_scripts', [$this, 'enqueue_scripts']);
		add_action('admin_footer', [$this, 'add_admin_footer_js']);
	}

	/**
	 * Adds the settings page to the WordPress admin.
	 */
	public function add_settings_page() {
		add_options_page(
			'WP AI Image Gen Settings', // Page title
			'WP AI Image Gen',          // Menu title
			'manage_options',           // Capability
			'wp-ai-image-gen-settings', // Menu slug
			[$this, 'render_settings_page'] // Callback
		);
	}

	/**
	 * Renders the settings page.
	 */
	public function render_settings_page() {
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
	 * Registers all settings for the plugin.
	 */
	public function register_settings() {
		$this->migrate_api_keys();

		// Register settings
		register_setting(
			'wp_ai_image_gen_settings',
			'wp_ai_image_gen_provider_api_keys',
			['sanitize_callback' => [$this, 'sanitize_provider_api_keys']]
		);

		register_setting(
			'wp_ai_image_gen_settings',
			'wp_ai_image_gen_provider_models',
			['sanitize_callback' => [$this, 'sanitize_provider_models']]
		);

		// Add settings section
		add_settings_section(
			'wp_ai_image_gen_settings_section',
			'AI Image Providers',
			[$this, 'render_providers_section'],
			'wp-ai-image-gen-settings'
		);

		// Add settings fields for each provider
		$providers = $this->provider_manager->get_provider_list();
		foreach ($providers as $provider_id => $provider_name) {
			$this->add_provider_fields($provider_id, $provider_name);
		}
	}

	/**
	 * Adds settings fields for a specific provider.
	 */
	private function add_provider_fields($provider_id, $provider_name) {
		// API Key Field
		add_settings_field(
			"wp_ai_image_gen_{$provider_id}_api_key",
			"{$provider_name} API Key",
			[$this, 'render_api_key_field'],
			'wp-ai-image-gen-settings',
			'wp_ai_image_gen_settings_section',
			[
				'provider_id' => $provider_id,
				'provider_name' => $provider_name,
			]
		);

		// Model Selection Field
		add_settings_field(
			"wp_ai_image_gen_{$provider_id}_model",
			"{$provider_name} Model",
			[$this, 'render_model_field'],
			'wp-ai-image-gen-settings',
			'wp_ai_image_gen_settings_section',
			[
				'provider_id' => $provider_id,
				'provider_name' => $provider_name,
				'models' => $this->get_models_for_provider($provider_id),
			]
		);
	}

	/**
	 * Migrates old API key options to the new structure.
	 * This function should be called before registering settings.
	 */
	private function migrate_api_keys() {
		$provider_api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
		$migration_needed = false;

		// Check if OpenAI key exists in old format
		$openai_key = get_option('wp_ai_image_gen_openai_api_key');
		if ($openai_key && !isset($provider_api_keys['openai'])) {
			$provider_api_keys['openai'] = $openai_key;
			$migration_needed = true;
		}

		// Update the option if migration was needed
		if ($migration_needed) {
			update_option('wp_ai_image_gen_provider_api_keys', $provider_api_keys);
			delete_option('wp_ai_image_gen_openai_api_key');
		}
	}

	/**
	 * Sanitizes the provider API keys before saving.
	 * 
	 * @param array $input The input array of provider API keys.
	 * @return array The sanitized array of provider API keys.
	 */
	public function sanitize_provider_api_keys($input) {
		$sanitized_input = [];
		foreach ($input as $provider_id => $api_key) {
			$sanitized_input[$provider_id] = sanitize_text_field($api_key);
		}
		return $sanitized_input;
	}

	/**
	 * Sanitizes the provider models before saving.
	 * 
	 * @param array $input The input array of provider models.
	 * @return array The sanitized array of provider models.
	 */
	public function sanitize_provider_models($input) {
		$sanitized_input = [];
		foreach ($input as $provider_id => $model) {
			$sanitized_input[$provider_id] = sanitize_text_field($model);
		}
		return $sanitized_input;
	}

	/**
	 * Gets the list of available models for a specific provider.
	 * 
	 * @param string $provider_id The ID of the provider.
	 * @return array An array of available models.
	 */
	private function get_models_for_provider($provider_id) {
		$provider = $this->provider_manager->get_provider($provider_id);
		return $provider ? $provider->get_available_models() : [];
	}

	/**
	 * Renders the providers section description.
	 */
	public function render_providers_section() {
		$providers = $this->provider_manager->get_provider_list();
		
		if (empty($providers)) {
			wp_ai_image_gen_debug_log("No providers available in the provider list");
			echo '<p class="notice notice-warning">No AI image providers are currently available. Please check the plugin installation.</p>';
		} else {
			wp_ai_image_gen_debug_log("Available providers: " . wp_json_encode($providers));
			echo '<p>Configure your API keys and models for each AI image provider.</p>';
			echo '<p>Available providers: ' . esc_html(implode(', ', $providers)) . '</p>';
		}
	}

	/**
	 * Renders the API key field for a provider.
	 * 
	 * @param array $args The field arguments.
	 */
	public function render_api_key_field($args) {
		$provider_id = $args['provider_id'];
		$api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
		$value = isset($api_keys[$provider_id]) ? $api_keys[$provider_id] : '';
		?>
		<input type="password" 
			   id="wp_ai_image_gen_<?php echo esc_attr($provider_id); ?>_api_key"
			   name="wp_ai_image_gen_provider_api_keys[<?php echo esc_attr($provider_id); ?>]"
			   value="<?php echo esc_attr($value); ?>"
			   class="regular-text">
		<button type="button" 
				class="button wp-ai-image-gen-remove-key" 
				data-provider="<?php echo esc_attr($provider_id); ?>">
			Remove Key
		</button>
		<?php
	}

	/**
	 * Renders the model selection field for a provider.
	 * 
	 * @param array $args The field arguments.
	 */
	public function render_model_field($args) {
		$provider_id = $args['provider_id'];
		$models = $args['models'];
		$saved_models = get_option('wp_ai_image_gen_provider_models', []);
		$selected = isset($saved_models[$provider_id]) ? $saved_models[$provider_id] : '';
		?>
		<select name="wp_ai_image_gen_provider_models[<?php echo esc_attr($provider_id); ?>]">
			<option value="">Select a model</option>
			<?php foreach ($models as $model_id => $model_name) : ?>
				<option value="<?php echo esc_attr($model_id); ?>" 
						<?php selected($selected, $model_id); ?>>
					<?php echo esc_html($model_name); ?>
				</option>
			<?php endforeach; ?>
		</select>
		<?php
	}

	/**
	 * Enqueues the necessary scripts and styles for the admin interface.
	 * 
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_scripts($hook) {
		// Only load on our settings page
		if ($hook !== 'settings_page_wp-ai-image-gen-settings') {
			return;
		}

		// Enqueue the main plugin script
		wp_enqueue_script(
			'wp-ai-image-gen-admin',
			plugin_dir_url(dirname(__FILE__)) . 'assets/js/admin.js',
			['jquery'],
			'1.0.0',
			true
		);

		// Enqueue admin styles if needed
		wp_enqueue_style(
			'wp-ai-image-gen-admin',
			plugin_dir_url(dirname(__FILE__)) . 'assets/css/admin.css',
			[],
			'1.0.0'
		);

		// Add any localized data if needed
		wp_localize_script('wp-ai-image-gen-admin', 'wpAiImageGen', [
			'ajaxUrl' => admin_url('admin-ajax.php'),
			'nonce' => wp_create_nonce('wp_ai_image_gen_nonce'),
		]);
	}

	/**
	 * Adds JavaScript to the admin footer for API key removal functionality.
	 */
	public function add_admin_footer_js() {
		$screen = get_current_screen();
		if ($screen->id !== 'settings_page_wp-ai-image-gen-settings') {
			return;
		}
		?>
		<script>
		document.addEventListener('DOMContentLoaded', function() {
			// Get all remove buttons
			var removeButtons = document.querySelectorAll('.wp-ai-image-gen-remove-key');
			
			// Add click event listener to each remove button
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
}

// Initialize the admin functionality
add_action('init', function() {
	WP_AI_Image_Gen_Admin::get_instance();
});

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
				'recraft-ai/recraft-v3'          => 'Recraft V3 by Recraft AI (high quality)',
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
 * Load the script.
 */
function wp_ai_image_gen_enqueue_script() {
	wp_enqueue_script('wp-ai-image-gen', plugin_dir_url(__FILE__) . '../build/index.js', ['wp-blocks', 'wp-i18n', 'wp-editor'], '1.0.0', true);
}
add_action('admin_enqueue_scripts', 'wp_ai_image_gen_enqueue_script');

/**
 * Gets the list of available providers.
 *
 * @return array Associative array of provider IDs and names.
 */
function wp_ai_image_gen_get_providers() {
	$provider_manager = WP_AI_Image_Provider_Manager::get_instance();
	return $provider_manager->get_provider_list();
}
