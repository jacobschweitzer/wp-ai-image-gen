<?php
/**
 * REST policy boundary tests.
 *
 * @package KaiGen
 */

// phpcs:disable Squiz.Commenting.FunctionComment.Missing,PHPCompatibility.FunctionDeclarations.NewReturnTypeDeclarations.voidFound,PHPCompatibility.Lists.NewShortList.Found

namespace KaiGen\Tests\PHP;

use KaiGen\Rest_API;
use KaiGen\Tests\PHP\Support\WordPress_Stub_State;
use PHPUnit\Framework\TestCase;

/**
 * Tests route wiring and capability policy without emulating Core dispatch.
 */
final class RestApiTest extends TestCase {
	protected function setUp(): void {
		WordPress_Stub_State::reset();
	}

	public function test_permission_requires_upload_files_capability(): void {
		$api = Rest_API::get_instance();

		$this->assertFalse( $api->check_permission() );

		WordPress_Stub_State::$capabilities['upload_files'] = true;

		$this->assertTrue( $api->check_permission() );
	}

	public function test_registers_expected_routes_with_shared_permission_policy(): void {
		$api = Rest_API::get_instance();

		$api->register_routes();

		$this->assertSame(
			[
				'/generate-image',
				'/reference-images',
				'/providers',
			],
			array_column( WordPress_Stub_State::$routes, 1 )
		);

		foreach ( WordPress_Stub_State::$routes as [ , , $arguments ] ) {
			$this->assertSame( [ $api, 'check_permission' ], $arguments['permission_callback'] );
		}

		$generate_arguments = WordPress_Stub_State::$routes[0][2];
		$this->assertSame( 'POST', $generate_arguments['methods'] );
		$this->assertTrue( $generate_arguments['args']['prompt']['required'] );
		$this->assertSame( 'integer', $generate_arguments['args']['source_image_ids']['items']['type'] );
	}

	public function test_missing_ai_client_returns_an_empty_provider_response(): void {
		$this->assertSame( [], Rest_API::get_instance()->get_image_providers()->get_data() );
	}
}
