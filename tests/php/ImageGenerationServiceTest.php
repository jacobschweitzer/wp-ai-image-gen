<?php
/**
 * Behavioral tests for the image generation service.
 *
 * @package KaiGen
 */

namespace KaiGen\Tests\PHP;

use KaiGen\Image_Generation_Service;
use PHPUnit\Framework\TestCase;
use WP_Error;

require_once KAIGEN_TESTS_ROOT . '/tests/php/stubs/class-wp-error.php';
require_once KAIGEN_TESTS_ROOT . '/tests/php/stubs/kaigen-functions.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-image-generation-service.php';

/**
 * Tests image generation service dependency fallbacks.
 */
final class ImageGenerationServiceTest extends TestCase {
	/**
	 * Tests that an unavailable AI Client returns the expected error.
	 *
	 * @return void
	 */
	public function test_unavailable_client_returns_expected_error() {
		$request = new class() {
			/**
			 * Gets a generation request parameter.
			 *
			 * @param string $name Parameter name.
			 * @return mixed Parameter value.
			 */
			public function get_param( $name ) {
				$params = [
					'prompt'           => 'subject',
					'provider'         => 'auto',
					'orientation'      => 'square',
					'source_image_ids' => [],
				];

				return $params[ $name ] ?? null;
			}
		};

		$result = ( new Image_Generation_Service() )->generate_from_request( $request );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'ai_client_unavailable', $result->get_error_code() );
		$this->assertSame( 501, $result->get_error_data()['status'] );
	}

	/**
	 * Tests that request validation runs before the AI Client availability check.
	 *
	 * @return void
	 */
	public function test_missing_prompt_returns_validation_error_before_unavailable_client_error() {
		$request = new class() {
			/**
			 * Gets a generation request parameter.
			 *
			 * @param string $name Parameter name.
			 * @return mixed Parameter value.
			 */
			public function get_param( $name ) {
				$params = [
					'prompt'      => '',
					'provider'    => 'auto',
					'orientation' => 'square',
				];

				return $params[ $name ] ?? null;
			}
		};

		$result = ( new Image_Generation_Service() )->generate_from_request( $request );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'missing_prompt', $result->get_error_code() );
		$this->assertSame( 400, $result->get_error_data()['status'] );
	}
}
