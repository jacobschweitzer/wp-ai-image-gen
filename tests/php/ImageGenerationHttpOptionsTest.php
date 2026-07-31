<?php
/**
 * Behavioral tests for image generation HTTP retry options.
 *
 * @package KaiGen
 */

namespace KaiGen\Tests\PHP;

use KaiGen\Image_Generation_HTTP_Options;
use PHPUnit\Framework\TestCase;

require_once KAIGEN_TESTS_ROOT . '/tests/php/stubs/kaigen-functions.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-image-generation-http-options.php';

/**
 * Tests the real retry option implementation.
 */
final class ImageGenerationHttpOptionsTest extends TestCase {
	/**
	 * Resets recorded WordPress and cURL calls.
	 *
	 * @return void
	 */
	protected function setUp(): void {
		$GLOBALS['kaigen_test_hooks']        = [];
		$GLOBALS['kaigen_test_curl_options'] = [];
	}

	/**
	 * Tests that retry hooks are registered and removed as a pair.
	 *
	 * @return void
	 */
	public function test_register_and_unregister_own_the_retry_hooks() {
		$options = new Image_Generation_HTTP_Options( 180 );

		$options->register();

		$this->assertCount( 1, $GLOBALS['kaigen_test_hooks']['http_request_args'][10] );
		$this->assertCount( 1, $GLOBALS['kaigen_test_hooks']['http_api_curl'][10] );
		$this->assertSame( 2, $GLOBALS['kaigen_test_hooks']['http_request_args'][10][0]['accepted_args'] );
		$this->assertSame( 3, $GLOBALS['kaigen_test_hooks']['http_api_curl'][10][0]['accepted_args'] );

		$options->unregister();

		$this->assertEmpty( $GLOBALS['kaigen_test_hooks']['http_request_args'][10] );
		$this->assertEmpty( $GLOBALS['kaigen_test_hooks']['http_api_curl'][10] );
	}

	/**
	 * Tests that a too-short timeout is raised for the retry.
	 *
	 * @return void
	 */
	public function test_filter_raises_a_short_timeout() {
		$options = new Image_Generation_HTTP_Options( 180 );

		$this->assertSame(
			[ 'timeout' => 180 ],
			$options->filter_image_generation_request_args( [ 'timeout' => 30 ], 'https://example.com' )
		);
	}

	/**
	 * Tests that a caller's longer timeout is preserved.
	 *
	 * @return void
	 */
	public function test_filter_preserves_a_longer_timeout() {
		$options = new Image_Generation_HTTP_Options( 180 );

		$this->assertSame(
			[
				'timeout'     => 240,
				'redirection' => 2,
			],
			$options->filter_image_generation_request_args(
				[
					'timeout'     => 240,
					'redirection' => 2,
				],
				'https://example.com'
			)
		);
	}

	/**
	 * Tests that timeout inputs are normalized before reaching WordPress and cURL.
	 *
	 * @return void
	 */
	public function test_timeout_inputs_are_normalized_and_forwarded() {
		$zero_timeout_options = new Image_Generation_HTTP_Options( 0 );

		$this->assertSame(
			[ 'timeout' => 0 ],
			$zero_timeout_options->filter_image_generation_request_args( [], 'https://example.com' )
		);
		$this->assertSame(
			[ 'timeout' => 1 ],
			$zero_timeout_options->filter_image_generation_request_args(
				[ 'timeout' => '1.5' ],
				'https://example.com'
			)
		);

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- In-memory resource stands in for a cURL handle.
		$handle               = fopen( 'php://memory', 'r' );
		$long_timeout_options = new Image_Generation_HTTP_Options( 180 );
		$long_timeout_options->apply_image_generation_curl_options(
			$handle,
			[ 'timeout' => 240 ],
			'https://example.com'
		);
		$this->assertSame( 240, $GLOBALS['kaigen_test_curl_options'][ CURLOPT_TIMEOUT ] );

		$zero_timeout_options->apply_image_generation_curl_options(
			$handle,
			[ 'timeout' => '1.5' ],
			'https://example.com'
		);
		$this->assertSame( 1, $GLOBALS['kaigen_test_curl_options'][ CURLOPT_TIMEOUT ] );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Closes the in-memory test resource.
		fclose( $handle );
	}

	/**
	 * Tests the complete set of cURL retry safeguards.
	 *
	 * @return void
	 */
	public function test_curl_retry_options_cover_timeout_connection_and_low_speed() {
		$options = new Image_Generation_HTTP_Options( 180 );
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- In-memory resource stands in for a cURL handle.
		$handle = fopen( 'php://memory', 'r' );

		$options->apply_image_generation_curl_options(
			$handle,
			[ 'timeout' => 30 ],
			'https://example.com'
		);

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- Closes the in-memory test resource.
		fclose( $handle );

		$this->assertSame( 180, $GLOBALS['kaigen_test_curl_options'][ CURLOPT_TIMEOUT ] );
		$this->assertSame( 30, $GLOBALS['kaigen_test_curl_options'][ CURLOPT_CONNECTTIMEOUT ] );
		$this->assertSame( 1, $GLOBALS['kaigen_test_curl_options'][ CURLOPT_LOW_SPEED_LIMIT ] );
		$this->assertSame( 180, $GLOBALS['kaigen_test_curl_options'][ CURLOPT_LOW_SPEED_TIME ] );
	}
}
