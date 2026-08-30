<?php
/**
 * Prompt refinement behavior tests.
 *
 * @package KaiGen
 */

// phpcs:disable Squiz.Commenting.FunctionComment.Missing,PHPCompatibility.FunctionDeclarations.NewReturnTypeDeclarations.voidFound

namespace KaiGen\Tests\PHP;

use KaiGen\Prompt_Refinement_Service;
use KaiGen\Tests\PHP\Support\WordPress_Stub_State;
use PHPUnit\Framework\TestCase;
use WP_REST_Request;

/**
 * Executes stable refinement error behavior.
 */
final class PromptRefinementServiceTest extends TestCase {
	protected function setUp(): void {
		WordPress_Stub_State::reset();
	}

	public function test_missing_ai_client_returns_stable_error(): void {
		$service = new Prompt_Refinement_Service( 'wp_ai_client_prompt', static fn() => false );

		$result = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A red fox' ] ) );

		$this->assertSame( 'ai_client_unavailable', $result->get_error_code() );
		$this->assertSame( 501, $result->get_error_data()['status'] );
	}

	public function test_malformed_generation_json_returns_stable_error(): void {
		WordPress_Stub_State::$text_results = [ 'not json' ];
		$service                            = new Prompt_Refinement_Service( 'wp_ai_client_prompt', static fn() => true );

		$result = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A red fox' ] ) );

		$this->assertSame( 'invalid_prompt_refinement_response', $result->get_error_code() );
		$this->assertSame( 500, $result->get_error_data()['status'] );
	}

	public function test_resolves_default_prompt_factory_when_request_runs(): void {
		WordPress_Stub_State::$text_results = [ '{"terms":[]}' ];
		$factory_calls                      = 0;
		$service                            = new Prompt_Refinement_Service( null, static fn() => true );

		add_filter(
			'kaigen_ai_client_prompt_factory',
			static function () use ( &$factory_calls ) {
				return static function ( ...$arguments ) use ( &$factory_calls ) {
					++$factory_calls;
					return wp_ai_client_prompt( ...$arguments );
				};
			}
		);

		$response = $service->generate_from_request( new WP_REST_Request( [ 'prompt' => 'A red fox' ] ) );

		$this->assertSame( 1, $factory_calls );
		$this->assertSame( [], $response->get_data()['terms'] );
	}

	public function test_provider_exception_returns_operation_specific_error(): void {
		WordPress_Stub_State::$text_results = [ new \RuntimeException( 'Provider failed' ) ];
		$service                            = new Prompt_Refinement_Service( 'wp_ai_client_prompt', static fn() => true );

		$result = $service->apply_choice_from_request(
			new WP_REST_Request(
				[
					'prompt' => 'A red fox',
					'term'   => 'red',
					'choice' => 'rust-colored',
				]
			)
		);

		$this->assertSame( 'prompt_refinement_application_failed', $result->get_error_code() );
	}
}
