<?php
/**
 * Regression test for timeout classification.
 *
 * @package KaiGen
 */

// phpcs:disable Squiz.Commenting.FunctionComment.Missing,PHPCompatibility.FunctionDeclarations.NewReturnTypeDeclarations.voidFound

namespace KaiGen\Tests\PHP;

use KaiGen\Image_Generation_Service;
use KaiGen\Tests\PHP\Support\WordPress_Stub_State;
use PHPUnit\Framework\TestCase;
use WP_Error;
use WP_REST_Request;

/**
 * Guards timeout retry ownership with executed behavior.
 */
final class TimeoutHandlingTest extends TestCase {
	public function test_low_speed_error_is_retryable(): void {
		WordPress_Stub_State::reset();
		WordPress_Stub_State::$image_results = [
			new WP_Error( 'http_request_failed', 'Transfer aborted due to low speed' ),
			new WP_Error( 'provider_error', 'Second attempt failed' ),
		];
		$service                             = new Image_Generation_Service(
			'wp_ai_client_prompt',
			static fn() => null,
			null,
			static fn() => true
		);

		$result = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A lighthouse' ] ) );

		$this->assertSame( 'provider_error', $result->get_error_code() );
		$this->assertCount(
			2,
			array_filter(
				WordPress_Stub_State::$builder_calls,
				static fn( $call ) => 'generate_image_result' === $call[0]
			)
		);
	}
}
