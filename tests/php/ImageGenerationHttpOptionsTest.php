<?php
/**
 * Tests for conditional image generation HTTP options.
 *
 * @package KaiGen
 */

// phpcs:disable Squiz.Commenting.FunctionComment.Missing,PHPCompatibility.FunctionDeclarations.NewReturnTypeDeclarations.voidFound,WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

namespace KaiGen\Tests\PHP;

use KaiGen\Image_Generation_HTTP_Options;
use KaiGen\Tests\PHP\Support\WordPress_Stub_State;
use PHPUnit\Framework\TestCase;

/**
 * Verifies the public retry hook lifecycle.
 */
final class ImageGenerationHttpOptionsTest extends TestCase {
	protected function setUp(): void {
		WordPress_Stub_State::reset();
	}

	public function test_register_filters_timeout_and_unregister_balances_hooks(): void {
		$options = new Image_Generation_HTTP_Options( 180 );

		$options->register();

		$this->assertSame( 180, apply_filters( 'http_request_args', [ 'timeout' => 30 ], 'https://example.test' )['timeout'] );
		$this->assertArrayHasKey( 'http_api_curl', WordPress_Stub_State::$hooks );

		$options->unregister();

		$this->assertEmpty( WordPress_Stub_State::$hooks['http_request_args'][10] );
		$this->assertEmpty( WordPress_Stub_State::$hooks['http_api_curl'][10] );
		$this->assertSame( [ 'add', 'add', 'remove', 'remove' ], array_column( WordPress_Stub_State::$hook_calls, 0 ) );
	}

	public function test_filter_preserves_a_larger_existing_timeout(): void {
		$options = new Image_Generation_HTTP_Options( 180 );

		$this->assertSame(
			240,
			$options->filter_image_generation_request_args( [ 'timeout' => 240 ], 'https://example.test' )['timeout']
		);
	}

	public function test_curl_retry_options_preserve_larger_timeouts_and_bound_slow_transfers(): void {
		$options = new Image_Generation_HTTP_Options( 180 );

		foreach ( [ 0, 30, 240 ] as $timeout ) {
			$options->apply_image_generation_curl_options( null, [ 'timeout' => $timeout ], 'https://example.test' );

			$this->assertSame(
				[
					CURLOPT_TIMEOUT         => max( 180, $timeout ),
					CURLOPT_CONNECTTIMEOUT  => 30,
					CURLOPT_LOW_SPEED_LIMIT => 1,
					CURLOPT_LOW_SPEED_TIME  => 180,
				],
				WordPress_Stub_State::$curl_options
			);
		}
	}
}
