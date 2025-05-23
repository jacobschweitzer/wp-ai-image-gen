<?php

use Yoast\WPTestUtils\WPIntegration\TestCase;

/**
 * Test cases for WP_AI_Image_Gen_REST_Controller class.
 */
class Test_WP_AI_Image_Gen_REST_Controller extends TestCase {

    protected $controller;

    public function set_up() {
        parent::set_up();
        // Mock the provider manager and its methods for isolation if necessary
        // For now, we'll create a real instance, assuming dependent methods are simple or will be mocked via WordPress hooks.
        
        // Ensure necessary plugin files are loaded for the class to exist
        // This might require including the main plugin file or specific class files
        // For example: require_once dirname(dirname(dirname(__FILE__))) . '/inc/class-rest-api.php';
        // And: require_once dirname(dirname(dirname(__FILE__))) . '/inc/class-provider-manager.php'; 
        // And provider interfaces/classes if they are directly type-hinted or used.

        if (!class_exists('WP_AI_Image_Gen_REST_Controller')) {
            require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/class-rest-api.php';
        }
        if (!class_exists('WP_AI_Image_Provider_Manager')) {
            require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/class-provider-manager.php';
        }
        // Ensure provider interface is loaded
        if (!interface_exists('WP_AI_Image_Provider_Interface')) {
            require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/class-image-provider-interface.php';
        }
        // Ensure base provider class is loaded (if used for type hinting or direct instantiation)
        if (!class_exists('WP_AI_Image_Provider_Base')) {
             require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/providers/class-image-provider-base.php';
        }


        $this->controller = new WP_AI_Image_Gen_REST_Controller();
    }

    /**
     * Test get_provider_model method.
     * @dataProvider providerGetProviderModel
     */
    public function testGetProviderModel($provider_id, $quality_settings, $expected_model, $is_wp_error = false) {
        // Mock get_option for quality settings
        $this->mock_get_option('wp_ai_image_gen_quality_settings', $quality_settings);

        if ($provider_id === 'replicate') {
            // Mock the provider manager and the replicate provider
            $mock_replicate_provider = $this->getMockBuilder('WP_AI_Image_Provider_Replicate') // Assuming this class exists
                                         ->disableOriginalConstructor()
                                         ->setMethods(['get_model_from_quality_setting'])
                                         ->getMock();
            
            $expected_quality_param = $quality_settings['quality'] ?? 'medium'; // Default quality
            $mock_replicate_provider->expects($this->once())
                                    ->method('get_model_from_quality_setting')
                                    ->with($expected_quality_param)
                                    ->willReturn($expected_model); // The model name replicate should return

            $mock_provider_manager = $this->getMockBuilder('WP_AI_Image_Provider_Manager')
                                          ->disableOriginalConstructor()
                                          ->setMethods(['get_provider'])
                                          ->getMock();
            $mock_provider_manager->method('get_provider')
                                  ->with('replicate')
                                  ->willReturn($mock_replicate_provider);

            // Replace the global provider manager instance
            $GLOBALS['wp_ai_image_gen_provider_manager_instance'] = $mock_provider_manager;
            // Hook to return the mock manager
            add_filter('wp_ai_image_gen_provider_manager_instance_filter', function() use ($mock_provider_manager) {
                return $mock_provider_manager;
            }, 10, 0);

            // Need a way to inject this mock manager or ensure wp_ai_image_gen_provider_manager() uses it.
            // This might involve replacing the global instance or using a filter if the plugin supports it.
            // For simplicity, if the plugin uses a global function like wp_ai_image_gen_provider_manager()
            // that internally calls WP_AI_Image_Provider_Manager::get_instance(), this can be tricky.
            // We might need to use a more direct approach or a helper function if available.
            // For now, we assume the filter `wp_ai_image_gen_provider_manager_instance_filter` exists or can be added.
            // If not, this part needs adjustment based on how the manager is accessed.
        }
        
        // Reflection to access private method
        $reflection = new ReflectionClass($this->controller);
        $method = $reflection->getMethod('get_provider_model');
        $method->setAccessible(true);
        $result = $method->invoke($this->controller, $provider_id);

        if ($is_wp_error) {
            $this->assertInstanceOf(WP_Error::class, $result);
            if ($result instanceof WP_Error) { // Additional check to satisfy static analysis
                $this->assertEquals('model_not_set', $result->get_error_code());
            }
        } else {
            $this->assertEquals($expected_model, $result);
        }
        
        // Clean up filter if added
        if ($provider_id === 'replicate') {
             remove_filter('wp_ai_image_gen_provider_manager_instance_filter', null, 10);
             if (isset($GLOBALS['wp_ai_image_gen_provider_manager_instance'])) {
                unset($GLOBALS['wp_ai_image_gen_provider_manager_instance']); // Clean up global
             }
        }
        $this->clear_mocked_option('wp_ai_image_gen_quality_settings');
    }

    public function providerGetProviderModel() {
        return [
            'openai' => ['openai', [], 'gpt-image-1', false], // Default quality settings
            'replicate_high' => ['replicate', ['quality' => 'high', 'style' => 'vivid'], 'replicate-model-high', false],
            'replicate_medium' => ['replicate', ['quality' => 'medium', 'style' => 'natural'], 'replicate-model-medium', false],
            'replicate_low' => ['replicate', ['quality' => 'low', 'style' => 'vivid'], 'replicate-model-low', false],
            'replicate_default_quality' => ['replicate', ['style' => 'natural'], 'replicate-model-medium', false], // Default to medium quality
            'replicate_default_style_and_quality' => ['replicate', [], 'replicate-model-medium', false], // Default to medium quality and natural style
            'unknown_provider' => ['unknown', [], 'error-should-be-wp-error', true],
        ];
    }

    /**
     * Test get_additional_params method.
     * @dataProvider providerGetAdditionalParams
     */
    public function testGetAdditionalParams($provider_id, $quality_settings_option, $request_params, $expected_params, $expect_style_key, $replicate_model_for_style_check = 'replicate-model-medium') {
        $this->mock_get_option('wp_ai_image_gen_quality_settings', $quality_settings_option);

        // Mock WP_REST_Request
        $mock_request = $this->getMockBuilder(WP_REST_Request::class)
                             ->disableOriginalConstructor()
                             ->setMethods(['get_param'])
                             ->getMock();
        
        // Default mock for get_param to return null unless specified in $request_params
        $mock_request->method('get_param')->willReturnCallback(function ($key) use ($request_params) {
            return $request_params[$key] ?? null;
        });
        
        // Ensure 'provider' is always returned from $request_params for the main logic
        // $mock_request->method('get_param')
        //              ->with('provider')
        //              ->willReturn($provider_id);


        if ($provider_id === 'replicate') {
            // Mock the provider manager and the replicate provider for model determination (related to style)
            $mock_replicate_provider = $this->getMockBuilder('WP_AI_Image_Provider_Replicate')
                                         ->disableOriginalConstructor()
                                         ->setMethods(['get_model_from_quality_setting'])
                                         ->getMock();
            
            $expected_quality_for_model = $quality_settings_option['quality'] ?? 'medium';
            $mock_replicate_provider->method('get_model_from_quality_setting')
                                    ->with($expected_quality_for_model)
                                    ->willReturn($replicate_model_for_style_check); // This model is used by get_additional_params

            $mock_provider_manager = $this->getMockBuilder('WP_AI_Image_Provider_Manager')
                                          ->disableOriginalConstructor()
                                          ->setMethods(['get_provider'])
                                          ->getMock();
            $mock_provider_manager->method('get_provider')
                                  ->with('replicate')
                                  ->willReturn($mock_replicate_provider);
            
            add_filter('wp_ai_image_gen_provider_manager_instance_filter', function() use ($mock_provider_manager) {
                return $mock_provider_manager;
            }, 10, 0);
        }

        $reflection = new ReflectionClass($this->controller);
        $method = $reflection->getMethod('get_additional_params');
        $method->setAccessible(true);
        $result = $method->invoke($this->controller, $mock_request);

        foreach ($expected_params as $key => $value) {
            $this->assertArrayHasKey($key, $result);
            $this->assertEquals($value, $result[$key]);
        }

        if ($expect_style_key) {
            $this->assertArrayHasKey('style', $result);
        } else {
            $this->assertArrayNotHasKey('style', $result);
        }
        
        if ($provider_id === 'replicate') {
            remove_filter('wp_ai_image_gen_provider_manager_instance_filter', null, 10);
            if (isset($GLOBALS['wp_ai_image_gen_provider_manager_instance'])) {
                 unset($GLOBALS['wp_ai_image_gen_provider_manager_instance']);
            }
        }
        $this->clear_mocked_option('wp_ai_image_gen_quality_settings');
    }

    public function providerGetAdditionalParams() {
        // $provider_id, $quality_settings_option, $request_params, $expected_params, $expect_style_key, $replicate_model_for_style_check
        return [
            'openai_hd' => [
                'openai', 
                ['quality' => 'hd', 'style' => 'vivid'], // DB option
                ['provider' => 'openai'], // Request params
                ['quality' => 'hd', 'output_quality' => 100, 'num_outputs' => 1, 'aspect_ratio' => '1:1', 'output_format' => 'webp'], // Expected in result
                false // No 'style' key for openai
            ],
            'openai_standard' => [
                'openai', 
                ['quality' => 'standard', 'style' => 'natural'], // DB option
                ['provider' => 'openai'],
                ['quality' => 'standard', 'output_quality' => 80, 'num_outputs' => 1],
                false
            ],
             'openai_default_quality_db' => [
                'openai', 
                ['style' => 'natural'], // DB option (quality defaults to standard)
                ['provider' => 'openai'],
                ['quality' => 'standard', 'output_quality' => 80], // output_quality derived from 'standard'
                false
            ],
            'replicate_natural_style' => [
                'replicate',
                ['quality' => 'medium', 'style' => 'natural'], // DB option
                ['provider' => 'replicate'], // Request params
                ['output_quality' => 80, 'num_outputs' => 1], // Expected in result (OpenAI 'quality' not present)
                true, // Expect 'style' key for replicate
                'replicate-model-medium' // Model that replicate provider returns
            ],
            'replicate_vivid_style' => [
                'replicate',
                ['quality' => 'high', 'style' => 'vivid'], // DB option
                ['provider' => 'replicate'], // Request params
                ['output_quality' => 100, 'num_outputs' => 1], // Expected in result
                true, // Expect 'style' key for replicate
                'replicate-model-high'
            ],
            // Replicate with recraft model to check different style mapping
            'replicate_recraft_model_natural_style' => [
                'replicate',
                ['quality' => 'medium', 'style' => 'natural'], // DB option
                ['provider' => 'replicate'], // Request params
                ['output_quality' => 80, 'style' => 'realistic_image'], // Expected style for recraft
                true, // Expect 'style' key for replicate
                'recraft-ai/recraft-v3' // Model that replicate provider returns
            ],
             'replicate_recraft_model_vivid_style' => [
                'replicate',
                ['quality' => 'hd', 'style' => 'vivid'], // DB option
                ['provider' => 'replicate'], // Request params
                ['output_quality' => 100, 'style' => 'digital_illustration'], // Expected style for recraft
                true, // Expect 'style' key for replicate
                'recraft-ai/recraft-v3' // Model that replicate provider returns
            ],
        ];
    }

    /**
     * Helper to mock get_option.
     */
    protected function mock_get_option($option_name, $return_value) {
        // Ensure we're not adding the same filter multiple times if called in a loop or multiple tests without teardown
        remove_filter("option_{$option_name}", [$this, 'get_mock_option_value'], 10);
        $this->current_mock_options[$option_name] = $return_value;
        add_filter("option_{$option_name}", [$this, 'get_mock_option_value'], 10, 1);
    }
    
    // Callback for the filter
    public function get_mock_option_value($option_name_passed = false) { // option_name_passed is for when filter passes it
        // The filter might pass the option name, or we might rely on the key used in add_filter.
        // This is a simplified example; direct access to $this->current_mock_options by key might be needed if filter passes option name.
        // For "option_{$option_name}" filter, it doesn't pass the option name to the callback by default.
        // We need to know which option this callback is for. A more robust way is to use unique callbacks or store multiple values.
        // For simplicity, assuming one option mocked at a time or using a map.
        // Let's refine this to handle multiple options by using the passed option name if available,
        // or by structuring $current_mock_options to be indexed by the full filter hook name.

        // This simplified version assumes the callback is specific enough or $option_name is correctly scoped.
        // A more robust solution would be:
        // $filter_name = current_filter(); // Get the name of the current filter
        // if (strpos($filter_name, 'option_') === 0) {
        //    $actual_option_name = substr($filter_name, strlen('option_'));
        //    if (isset($this->current_mock_options[$actual_option_name])) {
        //        return $this->current_mock_options[$actual_option_name];
        //    }
        // }
        // This current simplistic approach relies on the fact that $option_name is in scope of add_filter's callback.
        // Let's assume for now the test structure calls mock_get_option for one specific option at a time per test.
        // Or, more correctly, the anonymous function in mock_get_option captures $return_value.
        // The version below is for when using a class method as callback.
        
        // If WordPress passes the option name to the callback for "option_{$option_name}"
        if ($option_name_passed && isset($this->current_mock_options[$option_name_passed])) {
            return $this->current_mock_options[$option_name_passed];
        }
        // Fallback for filters that don't pass option name, relies on specific callback logic not shown here.
        // The original anonymous function approach is usually cleaner for this.
        // Sticking to the original anonymous function approach for mock_get_option.
        // The issue is if we try to use a single class method for all mocks.
        // The anonymous function `function() use ($return_value)` is fine. My previous `mock_get_option` was okay.

        // Reverting mock_get_option to use anonymous function as it's simpler and correct.
        // The change was to handle the tearDown. We need to store which options were mocked to remove them.
        // Let's stick to the previous implementation of mock_get_option and refine tear_down.
        // The issue was if the callback itself was a class method like $this->get_mock_option_value.
        // The provided snippet for mock_get_option was:
        // add_filter("option_{$option_name}", function() use ($return_value) { return $return_value; }, 10, 0);
        // This is fine. The problem is removing it if we don't have a reference to the anonymous function.
        // WordPress's remove_filter needs the same callback.
        // A solution is to use a class method or a uniquely identifiable callback.
        // For now, `remove_filter("option_{$option_name}", null, 10);` might not work as intended for anonymous functions.
        // However, for WPTestUtils or WP_UnitTestCase, often they handle cleanup or provide specific methods for options.
        // Let's assume `remove_filter` with null works or use a specific mechanism if available.
        // For now, I'll revert mock_get_option to its simpler form and manage removal in tear_down.
        // The critical part for tear_down is to remove the correct filter.
        // `remove_all_filters("option_{$option_name}");` could be an option if available and appropriate.

        // Let's use a property to store mocked option names for teardown.
        // (This callback `get_mock_option_value` is not actually used if `mock_get_option` uses an anonymous function directly)
        return null; 
    }


    protected $mocked_options = [];

    protected function mock_get_option($option_name, $return_value) {
        // Store the original value if you need to restore it, or just remove the filter.
        // For simplicity, just adding a filter.
        $callback = function() use ($return_value) {
            return $return_value;
        };
        $this->mocked_options[$option_name] = $callback; // Store callback for removal
        add_filter("option_{$option_name}", $callback, 10, 0);
    }


    /**
     * Helper to clear mocked options.
     */
    protected function clear_mocked_option($option_name) {
         // remove_filter("option_{$option_name}", null, 10); // This may not work for closures in all PHP/WP versions.
         // A more robust way is to remove the specific closure if stored, or use remove_all_filters.
         if (isset($this->mocked_options[$option_name])) {
            remove_filter("option_{$option_name}", $this->mocked_options[$option_name], 10);
            unset($this->mocked_options[$option_name]);
         }
    }

    public function tear_down() {
        $options_to_clear = array_keys($this->mocked_options);
        foreach ($options_to_clear as $option_name) {
            $this->clear_mocked_option($option_name);
        }
        // Clean up any global mocks for provider manager
        remove_filter('wp_ai_image_gen_provider_manager_instance_filter', null, 10);
        if (isset($GLOBALS['wp_ai_image_gen_provider_manager_instance'])) {
            unset($GLOBALS['wp_ai_image_gen_provider_manager_instance']);
        }
        parent::tear_down();
    }
}

// Helper function for wp_ai_image_gen_provider_manager mocking
// This needs to be defined if it's the way to override the manager instance in the plugin
if (!function_exists('wp_ai_image_gen_provider_manager')) {
    function wp_ai_image_gen_provider_manager() {
        if (isset($GLOBALS['wp_ai_image_gen_provider_manager_instance'])) {
            return $GLOBALS['wp_ai_image_gen_provider_manager_instance'];
        }
        // Check for a filter to allow replacing the instance.
        // This is a hypothetical filter. The actual plugin might have a different mechanism.
        $instance = apply_filters('wp_ai_image_gen_provider_manager_instance_filter', null);
        if ($instance) {
            return $instance;
        }
        return WP_AI_Image_Provider_Manager::get_instance();
    }
}

// Define WP_AI_IMAGE_GEN_PLUGIN_DIR if not defined
if (!defined('WP_AI_IMAGE_GEN_PLUGIN_DIR')) {
    define('WP_AI_IMAGE_GEN_PLUGIN_DIR', dirname(dirname(dirname(__FILE__))) . '/');
}

// Mock Replicate provider class if it's not auto-loadable or defined elsewhere
if (!class_exists('WP_AI_Image_Provider_Replicate')) {
    // This is a very basic mock. Adjust if the actual class has more structure.
    class WP_AI_Image_Provider_Replicate {
        public function __construct($apiKey = '', $model = '') {}
        public function get_model_from_quality_setting($quality) { return "replicate-model-{$quality}"; }
        public function get_id() { return 'replicate'; }
        public function get_name() { return 'Replicate'; }
        public function supports_image_to_image() { return true; }
        public function generate_image($prompt, $params) { return ['url' => 'http://example.com/image.png']; }
    }
}
// Mock OpenAI provider class as well for completeness, if needed for other tests
if (!class_exists('WP_AI_Image_Provider_OpenAI')) {
    class WP_AI_Image_Provider_OpenAI {
        public function __construct($apiKey = '', $model = '') {}
        public function get_id() { return 'openai'; }
        public function get_name() { return 'OpenAI'; }
        public function supports_image_to_image() { return true; } // gpt-image-1 supports it
        public function generate_image($prompt, $params) { return ['url' => 'http://example.com/image.png']; }
    }
}
?>
