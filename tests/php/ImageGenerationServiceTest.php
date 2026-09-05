<?php
/**
 * Image generation service behavior tests.
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
 * Executes image generation policy through resettable boundaries.
 */
final class ImageGenerationServiceTest extends TestCase {
	protected function setUp(): void {
		WordPress_Stub_State::reset();
	}

	public function test_reports_unavailable_ai_client_without_building_a_prompt(): void {
		$service = $this->make_service( static fn() => false );

		$result = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A lighthouse' ] ) );

		$this->assertSame( 'ai_client_unavailable', $result->get_error_code() );
		$this->assertSame( 501, $result->get_error_data()['status'] );
		$this->assertEmpty( WordPress_Stub_State::$builder_calls );
	}

	public function test_rejects_blank_prompt_before_generation(): void {
		$service = $this->make_service();

		$result = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => '   ' ] ) );

		$this->assertSame( 'missing_prompt', $result->get_error_code() );
		$this->assertEmpty( WordPress_Stub_State::$builder_calls );
	}

	public function test_resolves_default_prompt_factory_when_request_runs(): void {
		WordPress_Stub_State::$image_results = [
			new class() {
				public function to_file() {
					return new class() {
						public function get_data() {
							return 'late factory image';
						}
					};
				}
			},
		];
		$factory_calls                       = 0;
		$service                             = new Image_Generation_Service(
			null,
			static fn() => [
				'id'  => 42,
				'url' => 'https://example.test/image.png',
			],
			null,
			static fn() => true
		);

		add_filter(
			'kaigen_ai_client_prompt_factory',
			static function () use ( &$factory_calls ) {
				return static function ( ...$arguments ) use ( &$factory_calls ) {
					++$factory_calls;
					return wp_ai_client_prompt( ...$arguments );
				};
			}
		);

		$response = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A lighthouse' ] ) );

		$this->assertSame( 1, $factory_calls );
		$this->assertSame( 42, $response->get_data()['id'] );
	}

	public function test_timeout_error_retries_once_and_cleans_all_temporary_hooks(): void {
		WordPress_Stub_State::$image_results = [
			new WP_Error( 'http_request_failed', 'cURL error 28: Operation timed out' ),
			new class() {
				public function to_file() {
					return new class() {
						public function get_data() {
							return 'image bytes';
						}
					};
				}
			},
		];
		$uploads                             = [];
		$service                             = $this->make_service(
			null,
			static function ( $data, $prompt, $metadata ) use ( &$uploads ) {
				$uploads[] = [ $data, $prompt, $metadata ];
				return [
					'id'  => 42,
					'url' => 'https://example.test/image.png',
				];
			}
		);

		$response = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A lighthouse' ] ) );

		$this->assertSame( 2, $this->generation_call_count() );
		$this->assertSame( 'image bytes', $uploads[0][0] );
		$this->assertSame( 42, $response->get_data()['id'] );
		$this->assertEmpty( WordPress_Stub_State::$hooks['wp_ai_client_default_request_timeout'][10] );
		$this->assertEmpty( WordPress_Stub_State::$hooks['http_request_args'][10] );
		$this->assertEmpty( WordPress_Stub_State::$hooks['http_api_curl'][10] );
	}

	public function test_non_timeout_exception_is_not_retried_and_cleans_timeout_hook(): void {
		WordPress_Stub_State::$image_results = [ new \RuntimeException( 'Provider rejected request' ) ];
		$service                             = $this->make_service();

		$result = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A lighthouse' ] ) );

		$this->assertSame( 'ai_generation_failed', $result->get_error_code() );
		$this->assertSame( 1, $this->generation_call_count() );
		$this->assertEmpty( WordPress_Stub_State::$hooks['wp_ai_client_default_request_timeout'][10] );
		$this->assertArrayNotHasKey( 'http_request_args', WordPress_Stub_State::$hooks );
	}

	public function test_invalid_reference_id_is_skipped_before_provider_generation(): void {
		WordPress_Stub_State::$image_results = [ new WP_Error( 'provider_result', 'Provider reached.' ) ];
		$service                             = $this->make_service();

		$result = $service->generate_from_request(
			new WP_REST_Request(
				[
					'prompt'           => 'A lighthouse',
					'source_image_ids' => [ 'not-an-id' ],
				]
			)
		);

		$this->assertSame( 'provider_result', $result->get_error_code() );
		$this->assertSame( 1, $this->generation_call_count() );
	}

	public function test_forbidden_reference_id_never_reaches_provider_generation(): void {
		$service = $this->make_service();

		$result = $service->generate_from_request(
			new WP_REST_Request(
				[
					'prompt'           => 'A lighthouse',
					'source_image_ids' => [ 37 ],
				]
			)
		);

		$this->assertSame( 'forbidden_reference_file', $result->get_error_code() );
		$this->assertSame( 403, $result->get_error_data()['status'] );
		$this->assertSame( 0, $this->generation_call_count() );
	}

	public function test_missing_reference_file_never_reaches_provider_generation(): void {
		WordPress_Stub_State::$capabilities['edit_post:37'] = true;
		$service = $this->make_service();

		$result = $service->generate_from_request(
			new WP_REST_Request(
				[
					'prompt'           => 'A lighthouse',
					'source_image_ids' => [ 37 ],
				]
			)
		);

		$this->assertSame( 'missing_reference_file', $result->get_error_code() );
		$this->assertSame( 400, $result->get_error_data()['status'] );
		$this->assertSame( 0, $this->generation_call_count() );
	}

	public function test_supported_image_result_accessor_shapes_reach_uploader(): void {
		$cases = [
			'data-uri snake case' => new class() {
				public function to_file() {
					return new class() {
						public function get_data_uri() {
							return 'data:image/png;base64,c25ha2U=';
						}
					};
				}
			},
			'data-uri camel case' => new class() {
				// phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Mirrors the AI Client camel-case API.
				public function toFile() {
					return new class() {
						// phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Mirrors the AI Client camel-case API.
						public function getDataUri() {
							return 'data:image/png;base64,Y2FtZWw=';
						}
					};
				}
			},
			'data snake case'     => new class() {
				public function to_file() {
					return new class() {
						public function get_data() {
							return 'snake bytes';
						}
					};
				}
			},
			'data camel case'     => new class() {
				// phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Mirrors the AI Client camel-case API.
				public function toFile() {
					return new class() {
						// phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Mirrors the AI Client camel-case API.
						public function getData() {
							return 'camel bytes';
						}
					};
				}
			},
			'URL snake case'      => new class() {
				public function to_file() {
					return new class() {
						public function get_url() {
							return 'https://example.test/snake.png';
						}
					};
				}
			},
			'URL camel case'      => new class() {
				// phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Mirrors the AI Client camel-case API.
				public function toFile() {
					return new class() {
						// phpcs:ignore WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- Mirrors the AI Client camel-case API.
						public function getUrl() {
							return 'https://example.test/camel.png';
						}
					};
				}
			},
		];

		foreach ( $cases as $label => $result ) {
			WordPress_Stub_State::$image_results = [ $result ];
			$uploads                             = [];
			$service                             = $this->make_service(
				null,
				static function ( $data ) use ( &$uploads ) {
					$uploads[] = $data;
					return [
						'id'  => 42,
						'url' => 'https://example.test/image.png',
					];
				}
			);

			$response = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A lighthouse' ] ) );

			$this->assertSame( 42, $response->get_data()['id'], $label );
			$this->assertCount( 1, $uploads, $label );
		}
	}

	public function test_unsupported_image_file_shape_returns_stable_error(): void {
		WordPress_Stub_State::$image_results = [
			new class() {
				public function to_file() {
					return new \stdClass();
				}
			},
		];
		$service                             = $this->make_service();

		$result = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A lighthouse' ] ) );

		$this->assertSame( 'unsupported_image_result', $result->get_error_code() );
	}

	private function make_service( $available = null, $uploader = null ): Image_Generation_Service {
		return new Image_Generation_Service(
			'wp_ai_client_prompt',
			$uploader ?? static fn() => new WP_Error( 'unexpected_upload', 'Unexpected upload.' ),
			null,
			$available ?? static fn() => true
		);
	}

	private function generation_call_count(): int {
		return count(
			array_filter(
				WordPress_Stub_State::$builder_calls,
				static fn( $call ) => 'generate_image_result' === $call[0]
			)
		);
	}
}
