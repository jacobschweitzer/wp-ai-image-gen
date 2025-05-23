<?php
/**
 * Contains the admin page settings.
 *
 * @package wp-ai-image-gen
 */

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
	 * Holds the list of providers.
	 * @var array
	 */
	private $providers = [];

	/**
	 * Active providers list (active providers have an API key set).
	 * @var array
	 */
	private $active_providers = [];

	/**
	 * Initialize the admin functionality.
	 */
	private function __construct() {
		$this->providers = wp_ai_image_gen_get_providers();
		$this->active_providers = $this->get_active_providers();
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

		// Add the main provider setting to the editor settings
		add_filter('block_editor_settings_all', function($settings) {
			$main_provider = get_option('wp_ai_image_gen_main_provider', '');
			
			// Ensure settings is an array
			if (!is_array($settings)) {
				$settings = [];
			}
			
			// Add the main provider setting in all possible locations to ensure it's available
			$settings['wp_ai_image_gen_main_provider'] = $main_provider;
			
			if (!isset($settings['wp_ai_image_gen'])) {
				$settings['wp_ai_image_gen'] = [];
			}
			$settings['wp_ai_image_gen']['main_provider'] = $main_provider;
			
			// Add to editor settings directly
			if (!isset($settings['wp_ai_image_gen_settings'])) {
				$settings['wp_ai_image_gen_settings'] = [];
			}
			$settings['wp_ai_image_gen_settings']['main_provider'] = $main_provider;
			
			return $settings;
		}, 20); // Add a higher priority to ensure our settings are added after others
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

		// Register quality settings
		register_setting(
			'wp_ai_image_gen_settings',
			'wp_ai_image_gen_quality_settings',
			['sanitize_callback' => [$this, 'sanitize_quality_settings']]
		);

		// Register main provider setting
		register_setting(
			'wp_ai_image_gen_settings',
			'wp_ai_image_gen_main_provider',
			['sanitize_callback' => [$this, 'sanitize_main_provider']]
		);

		// Add settings section for providers
		add_settings_section(
			'wp_ai_image_gen_settings_section',
			'AI Image Providers',
			[$this, 'render_providers_section'],
			'wp-ai-image-gen-settings'
		);

		// Add quality settings section
		add_settings_section(
			'wp_ai_image_gen_quality_section',
			'Image Quality Settings',
			[$this, 'render_quality_section'],
			'wp-ai-image-gen-settings'
		);

		// Add main provider selection field
		add_settings_field(
			'wp_ai_image_gen_main_provider',
			'Main Provider',
			[$this, 'render_main_provider_field'],
			'wp-ai-image-gen-settings',
			'wp_ai_image_gen_settings_section',
			[
				'providers' => $this->active_providers,
			]
		);

		// Add settings fields for each provider
		foreach ($this->providers as $provider_id => $provider_name) {
			$this->add_provider_fields($provider_id, $provider_name);
		}

		// Add quality field
		add_settings_field(
			'wp_ai_image_gen_quality_setting',
			'Image Quality',
			[$this, 'render_quality_field'],
			'wp-ai-image-gen-settings',
			'wp_ai_image_gen_quality_section'
		);
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
	 * Sanitizes the quality settings.
	 * 
	 * @param array $input The input array of quality settings.
	 * @return array The sanitized array of quality settings.
	 */
	public function sanitize_quality_settings($input) {
		$sanitized_input = [];
		
		// Sanitize quality
		if (isset($input['quality']) && in_array($input['quality'], ['low', 'medium', 'high'])) {
			$sanitized_input['quality'] = $input['quality'];
		} else {
			$sanitized_input['quality'] = 'medium';
		}
		
		return $sanitized_input;
	}

	/**
	 * Renders the providers section description.
	 */
	public function render_providers_section() {
		if (empty($this->providers)) {
			wp_ai_image_gen_debug_log("No providers available in the provider list");
			echo '<p class="notice notice-warning">No AI image providers are currently available. Please check the plugin installation.</p>';
		} else {
			wp_ai_image_gen_debug_log("Available providers: " . wp_json_encode($this->providers));
			echo '<p>Configure your API keys and models for each AI image provider.</p>';
		}
	}

	/**
	 * Renders the quality settings section.
	 */
	public function render_quality_section() {
		echo '<p>Configure the quality settings for generated images.</p>';
	}

	/**
	 * Renders the quality field.
	 */
	public function render_quality_field() {
		$quality_settings = get_option('wp_ai_image_gen_quality_settings', []);
		$quality = isset($quality_settings['quality']) ? $quality_settings['quality'] : 'medium';
		?>
		<select name="wp_ai_image_gen_quality_settings[quality]">
			<option value="low" <?php selected($quality, 'low'); ?>>Low</option>
			<option value="medium" <?php selected($quality, 'medium'); ?>>Medium</option>
			<option value="high" <?php selected($quality, 'high'); ?>>High</option>
		</select>
		<p class="description">Select the quality level for generated images. Higher quality may result in longer generation times.</p>
		<?php
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
	 * Renders the main provider selection field.
	 */
	public function render_main_provider_field($args) {
		$main_provider = get_option('wp_ai_image_gen_main_provider', '');
		?>
		<select name="wp_ai_image_gen_main_provider">
			<option value="">Select Main Provider</option>
			<?php foreach ($args['providers'] as $provider_id) : ?>
				<option value="<?php echo esc_attr($provider_id); ?>" 
						<?php selected($main_provider, $provider_id); ?>>
					<?php echo esc_html($this->providers[$provider_id]); ?>
				</option>
			<?php endforeach; ?>
		</select>
		<p class="description">Select the main provider to use for image generation. This provider will be used as the default when generating images.</p>
		<?php
	}

	/**
	 * Sanitizes the main provider setting.
	 * 
	 * @param string $input The input value for the main provider.
	 * @return string The sanitized main provider value.
	 */
	public function sanitize_main_provider($input) {
		$sanitized_input = sanitize_text_field($input);
		// Only allow active providers to be set as main provider
		if (!empty($sanitized_input) && !in_array($sanitized_input, $this->active_providers)) {
			return '';
		}
		return $sanitized_input;
	}

	/**
	 * Enqueues the necessary scripts and styles for the admin interface.
	 * 
	 * @param string $hook The current admin page hook.
	 */
	public function enqueue_scripts($hook) {
		// Enqueue admin styles if needed
		wp_enqueue_style(
			'wp-ai-image-gen-admin',
			plugin_dir_url(dirname(__FILE__)) . 'assets/css/admin.css',
			[],
			'1.0.0'
		);

		// Enqueue block editor scripts
		if (in_array($hook, ['post.php', 'post-new.php'])) {
			// Get the main provider setting
			$main_provider = get_option('wp_ai_image_gen_main_provider', '');

			// If no main provider is set but we have active providers, use OpenAI if available, otherwise use the first active provider
			if (empty($main_provider) && !empty($this->active_providers)) {
				$api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);
				if (isset($api_keys['openai']) && !empty($api_keys['openai'])) {
					$main_provider = 'openai';
				} else {
					$main_provider = $this->active_providers[0];
				}
			}

			wp_enqueue_script(
				'wp-ai-image-gen-editor',
				plugin_dir_url(dirname(__FILE__)) . 'build/index.js',
				['wp-blocks', 'wp-element', 'wp-editor', 'wp-components', 'wp-i18n'],
				'1.0.0',
				true
			);

			// Add localized data for the editor
			wp_localize_script('wp-ai-image-gen-editor', 'wpAiImageGen', [
				'ajaxUrl' => admin_url('admin-ajax.php'),
				'nonce' => wp_create_nonce('wp_ai_image_gen_nonce'),
				'mainProvider' => $main_provider,
				'settings' => [
					'mainProvider' => $main_provider
				]
			]);
		}

		// Add localized data for admin scripts
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

	/**
	 * Gets the list of active providers.
	 * @return array The list of active providers.
	 */
	public function get_active_providers() {
		// Get the api keys from the options table
		$api_keys = get_option('wp_ai_image_gen_provider_api_keys', []);

		// Return the providers that have an api key set
		$active_providers = [];
		foreach ($this->providers as $provider_id => $provider_name) {
			if (isset($api_keys[$provider_id]) && !empty($api_keys[$provider_id])) {
				$active_providers[] = $provider_id;
			}
		}
		return $active_providers;
	}
}
function wp_ai_image_gen_admin() {
	return WP_AI_Image_Gen_Admin::get_instance();
}

add_action('init', function() {
	wp_ai_image_gen_admin();
});
