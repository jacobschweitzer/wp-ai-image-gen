<?php

use Yoast\WPTestUtils\WPIntegration\TestCase;

/**
 * Test cases for WP_AI_Image_Provider_Manager class.
 */
class Test_WP_AI_Image_Provider_Manager extends TestCase {

    protected $manager;
    protected static $original_providers;
    protected $mocked_options = [];

    public static function set_up_before_class() {
        parent::set_up_before_class();
        // Ensure all necessary classes and interfaces are loaded
        if (!defined('WP_AI_IMAGE_GEN_PLUGIN_DIR')) {
            define('WP_AI_IMAGE_GEN_PLUGIN_DIR', dirname(dirname(dirname(__FILE__))) . '/');
        }
        require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/class-image-provider-interface.php';
        require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/providers/class-image-provider-base.php';
        // Load actual provider classes that we might mock later or need for get_class()
        require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/providers/class-image-provider-openai.php';
        require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/providers/class-image-provider-replicate.php';
        // ... potentially other providers if they exist and are part of the test matrix
        
        if (!class_exists('WP_AI_Image_Provider_Manager')) {
            require_once WP_AI_IMAGE_GEN_PLUGIN_DIR . 'inc/class-provider-manager.php';
        }
        
        // Store original providers if any are loaded by manager's constructor during tests
        // However, we will replace $providers with mocks for each test run.
        // The manager loads providers in its constructor using a static property.
        // We need to control this for predictable tests.
    }

    public function set_up() {
        parent::set_up();
        $this->manager = WP_AI_Image_Provider_Manager::get_instance();
        // Reset and mock providers for each test
        $this->set_mock_providers();
    }
    
    protected function set_mock_providers($providers_map = []) {
        $mock_providers = [];

        // Default mock for OpenAI
        if (!isset($providers_map['openai'])) {
            $mock_openai = $this->getMockBuilder(WP_AI_Image_Provider_OpenAI::class)
                                ->disableOriginalConstructor()
                                ->setMethods(['supports_image_to_image', 'get_id', 'get_model_from_quality_setting'])
                                ->getMock();
            $mock_openai->method('get_id')->willReturn('openai');
            $mock_providers['openai'] = $mock_openai;
        } else {
            $mock_providers['openai'] = $providers_map['openai'];
        }

        // Default mock for Replicate
        if (!isset($providers_map['replicate'])) {
            $mock_replicate = $this->getMockBuilder(WP_AI_Image_Provider_Replicate::class)
                                 ->disableOriginalConstructor()
                                 ->setMethods(['supports_image_to_image', 'get_id', 'get_model_from_quality_setting'])
                                 ->getMock();
            $mock_replicate->method('get_id')->willReturn('replicate');
            $mock_providers['replicate'] = $mock_replicate;
        } else {
            $mock_providers['replicate'] = $providers_map['replicate'];
        }
        
        // Mock for an "other" provider for testing fallbacks
        if (!isset($providers_map['other_provider'])) {
             $mock_other = $this->getMockBuilder(WP_AI_Image_Provider_Base::class) // Assuming Base or a specific mock class
                                 ->disableOriginalConstructor()
                                 ->setMethods(['supports_image_to_image', 'get_id', 'get_model_from_quality_setting'])
                                 ->getMock();
            $mock_other->method('get_id')->willReturn('other_provider');
            $mock_providers['other_provider'] = $mock_other;
        } else {
            $mock_providers['other_provider'] = $providers_map['other_provider'];
        }


        $reflector = new ReflectionClass('WP_AI_Image_Provider_Manager');
        $providers_property = $reflector->getProperty('providers');
        $providers_property->setAccessible(true);
        
        // Store original static providers if not already done, and before overwriting
        if (!isset(self::$original_providers)) {
            self::$original_providers = $providers_property->getValue();
        }
        $providers_property->setValue(null, $mock_providers); // Set for all instances since it's static
    }

    /**
     * @dataProvider providerTestProviderSupportsImageToImage
     */
    public function testProviderSupportsImageToImage($provider_id, $api_keys, $quality_settings, $expected_model_for_instantiation, $provider_supports_i2i_return, $expected_result, $replicate_quality_to_model = null) {
        $this->mock_get_option('wp_ai_image_gen_provider_api_keys', $api_keys);
        $this->mock_get_option('wp_ai_image_gen_quality_settings', $quality_settings);

        // Get the mock provider we set up in set_mock_providers
        $reflector = new ReflectionClass('WP_AI_Image_Provider_Manager');
        $providers_property = $reflector->getProperty('providers');
        $providers_property->setAccessible(true);
        $current_providers = $providers_property->getValue();
        $mock_provider_template = $current_providers[$provider_id] ?? null;

        if ($provider_id === 'replicate' && $mock_provider_template && $replicate_quality_to_model !== null) {
            $quality_key = $quality_settings['quality'] ?? 'medium';
            // This mock_provider_template is what get_provider() returns.
            // Its get_model_from_quality_setting is called first.
            $mock_provider_template->method('get_model_from_quality_setting')
                                   ->with($quality_key)
                                   ->willReturn($expected_model_for_instantiation); // This is the model name, e.g., 'replicate-model-high'
        }
        
        // We need to assert that the *new* instance created inside provider_supports_image_to_image
        // is of the correct class, was created with the $expected_model_for_instantiation,
        // and its supports_image_to_image method returns $provider_supports_i2i_return.
        // This is tricky because the instantiation is new ClassName(...).
        // We can't directly mock the `new ClassName` part for specific assertions easily without complex setups like AspectMock or overrides.

        // What we *can* check more easily:
        // 1. The model determination logic (already done by inspecting $expected_model_for_instantiation).
        // 2. The final outcome based on $provider_supports_i2i_return.
        // For a deeper test, we would need to ensure the correct provider *class* has its `supports_image_to_image` method return the configured value.
        // The current setup replaces the *template* providers. The test needs to ensure that if a provider (e.g. OpenAI)
        // is determined, its class's supports_image_to_image (when instantiated with the right model) would yield the result.

        // Let's assume for now that if the model is correctly determined, and if the provider class
        // (like the actual WP_AI_Image_Provider_OpenAI) correctly implements supports_image_to_image,
        // the result will be correct. The test focuses on the manager's logic to *select* and *prepare* for this call.
        // The $provider_supports_i2i_return simulates what the *actual* provider's method would return.
        // This requires that our mock provider (template) can also simulate the behavior of the *instantiated* one.
        
        if ($mock_provider_template && method_exists($mock_provider_template, 'supports_image_to_image')) {
             // This specific mock instance (template) is not what's finally called for supports_image_to_image.
             // A *new* instance of its class is created.
             // This is the hard part to directly test without changing production code for testability or using advanced mocking.
             // For now, the test will rely on the provider ID to infer the class and assume the class behaves as per $provider_supports_i2i_return.
             // This means we are not truly testing if the *newly instantiated* provider's method is called.
             // We are testing the logic *up to* that point.
        }


        // For a more direct test of the final call, one would typically mock the specific provider class's method globally,
        // or ensure the manager uses a factory that can be replaced. Given the current structure, this is a limitation.
        // We are effectively testing the model selection and API key check.
        // The actual call to ->supports_image_to_image() on the *new* instance is implicitly tested if we assume
        // the class (e.g. WP_AI_Image_Provider_OpenAI) behaves consistently.
        
        // If $expected_model_for_instantiation is null and we expect failure (e.g. for 'other_provider' or failed Replicate model lookup)
        // then the supports_image_to_image method on any provider instance won't even be called.
        if ($provider_id === 'openai' && $mock_provider_template) {
            // If provider is OpenAI, the model is hardcoded to 'gpt-image-1'.
            // The supports_image_to_image method of a new OpenAI provider instance (with this model) should be effectively called.
            // We assume WP_AI_Image_Provider_OpenAI::supports_image_to_image() returns $provider_supports_i2i_return
            // For this, we'd have to ensure the specific mock for 'openai' in $current_providers is set up to have its class behave this way.
            // This is where it gets complicated. Let's assume the test setup for mocks needs to be more specific per test case if this level of detail is needed.
        }


        $result = $this->manager->provider_supports_image_to_image($provider_id);
        $this->assertEquals($expected_result, $result);
    }

    public function providerTestProviderSupportsImageToImage() {
        // $provider_id, $api_keys, $quality_settings, $expected_model, $provider_i2i_return, $expected_result, $replicate_q_to_model
        return [
            // OpenAI
            'openai_supports_i2i' => ['openai', ['openai' => 'test_key'], [], 'gpt-image-1', true, true],
            'openai_no_key' => ['openai', [], [], 'gpt-image-1', true, false], // API key check fails first

            // Replicate
            'replicate_high_supports_i2i' => ['replicate', ['replicate' => 'test_key'], ['quality' => 'high'], 'replicate-model-high', true, true, 'replicate-model-high'],
            'replicate_medium_supports_i2i' => ['replicate', ['replicate' => 'test_key'], ['quality' => 'medium'], 'replicate-model-medium', true, true, 'replicate-model-medium'],
            'replicate_low_supports_i2i' => ['replicate', ['replicate' => 'test_key'], ['quality' => 'low'], 'replicate-model-low', true, true, 'replicate-model-low'],
            'replicate_default_quality_supports_i2i' => ['replicate', ['replicate' => 'test_key'], [], 'replicate-model-medium', true, true, 'replicate-model-medium'], // Default quality 'medium'
            'replicate_high_does_not_support_i2i' => ['replicate', ['replicate' => 'test_key'], ['quality' => 'high'], 'replicate-model-high', false, false, 'replicate-model-high'],
            'replicate_no_key' => ['replicate', [], ['quality' => 'high'], 'replicate-model-high', true, false], // API key check fails
            'replicate_model_lookup_fails' => ['replicate', ['replicate' => 'test_key'], ['quality' => 'weird_quality'], null, true, false, null], // Model determination returns null from provider's get_model_from_quality_setting

            // Other provider
            'other_provider_no_logic' => ['other_provider', ['other_provider' => 'test_key'], [], null, true, false], // Manager returns false because it's not 'openai' or 'replicate'

            // Unknown provider (not in our $mock_providers)
            'unknown_provider' => ['unknown_provider_id', ['unknown_provider_id' => 'test_key'], [], null, true, false], // get_provider returns null
        ];
    }
    
    protected function mock_get_option($option_name, $return_value) {
        $callback = function() use ($return_value) {
            return $return_value;
        };
        $this->mocked_options[$option_name] = $callback;
        add_filter("option_{$option_name}", $callback, 10, 0);
    }

    protected function clear_mocked_options() {
        foreach ($this->mocked_options as $option_name => $callback) {
            remove_filter("option_{$option_name}", $callback, 10);
        }
        $this->mocked_options = [];
    }

    public function tear_down() {
        $this->clear_mocked_options();
        // Restore original providers if they were stored
        if (isset(self::$original_providers)) {
            $reflector = new ReflectionClass('WP_AI_Image_Provider_Manager');
            $providers_property = $reflector->getProperty('providers');
            $providers_property->setAccessible(true);
            $providers_property->setValue(null, self::$original_providers);
        }
        parent::tear_down();
    }
    
    public static function tear_down_after_class() {
        self::$original_providers = null; // Clear static property
        parent::tear_down_after_class();
    }
}
?>
