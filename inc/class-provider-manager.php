<?php
/**
 * Class that manages all AI image provider instances and their registration.
 */
class WP_AI_Image_Provider_Manager {
    /**
     * Holds the singleton instance of this class.
     * @var WP_AI_Image_Provider_Manager
     */
    private static $instance = null;

    /**
     * Stores all registered provider instances.
     * @var array
     */
    private $providers = [];

    /**
     * Private constructor to prevent direct instantiation.
     */
    private function __construct() {
        $this->load_providers();
    }

    /**
     * Gets the singleton instance of the provider manager.
     * @return WP_AI_Image_Provider_Manager The singleton instance.
     */
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Loads and instantiates all provider classes from the providers directory.
     */
    private function load_providers() {
        // Get the full path to the providers directory
        $providers_dir = plugin_dir_path(dirname(__FILE__)) . 'inc/providers/';
        
        // Log the providers directory path for debugging
        wp_ai_image_gen_debug_log("Loading providers from: " . $providers_dir);
        
        // Get all PHP files in the providers directory
        $provider_files = glob($providers_dir . 'class-image-provider-*.php');
        
        if (empty($provider_files)) {
            wp_ai_image_gen_debug_log("No provider files found in directory");
            return;
        }

        foreach ($provider_files as $provider_file) {
            require_once $provider_file;
            
            // Extract the class name from the filename
            // Convert filename like 'class-image-provider-replicate.php' to 'WP_AI_Image_Provider_Replicate'
            $class_name = str_replace(['class-', '-'], ['WP_AI_', '_'], basename($provider_file, '.php'));
            
            wp_ai_image_gen_debug_log("Attempting to load provider: " . $class_name);
            
            if (class_exists($class_name)) {
                // Create a new instance with default empty values
                $provider_instance = new $class_name('', '');
                if ($provider_instance instanceof WP_AI_Image_Provider_Interface) {
                    $this->providers[$provider_instance->get_id()] = $provider_instance;
                    wp_ai_image_gen_debug_log("Successfully loaded provider: " . $provider_instance->get_id());
                }
            }
        }
    }

    /**
     * Gets all registered providers.
     * @return array Associative array of provider instances.
     */
    public function get_providers() {
        return $this->providers;
    }

    /**
     * Gets all registered providers as id => name pairs.
     * @return array Associative array of provider IDs and names.
     */
    public function get_provider_list() {
        $provider_list = [];
        foreach ($this->providers as $provider) {
            $provider_list[$provider->get_id()] = $provider->get_name();
        }
        return $provider_list;
    }

    /**
     * Gets a specific provider instance by ID.
     * @param string $provider_id The ID of the provider to get.
     * @return WP_AI_Image_Provider_Interface|null The provider instance or null if not found.
     */
    public function get_provider($provider_id) {
        return isset($this->providers[$provider_id]) ? $this->providers[$provider_id] : null;
    }
} 