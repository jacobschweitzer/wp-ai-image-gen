<?php
/**
 * Provides a deterministic AI Client boundary for generation E2E tests.
 *
 * @package KaiGen
 */

/**
 * Returns the current generation fixture state.
 *
 * @return array Generation fixture state.
 */
function kaigen_e2e_get_generation_state() {
	return wp_parse_args(
		get_option( 'kaigen_e2e_generation_state', [] ),
		[
			'request_count'      => 0,
			'last_payload'       => null,
			'failure_prompt'     => '',
			'failures_remaining' => 0,
			'delay_ms'           => 0,
		]
	);
}

/**
 * Persists the generation fixture state.
 *
 * @param array $state Generation fixture state.
 * @return void
 */
function kaigen_e2e_set_generation_state( $state ) {
	update_option( 'kaigen_e2e_generation_state', $state, false );
}

/**
 * Core-style file result containing deterministic image bytes.
 */
final class KaiGen_E2E_Image_File {
	/**
	 * Returns a one-pixel PNG.
	 *
	 * @return string PNG bytes.
	 */
	public function get_data() {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- Fixed test fixture bytes.
		return base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' );
	}
}

/**
 * Core-style generated image result.
 */
final class KaiGen_E2E_Image_Result implements JsonSerializable {
	/**
	 * Returns the generated file.
	 *
	 * @return KaiGen_E2E_Image_File Generated file.
	 */
	public function to_file() {
		return new KaiGen_E2E_Image_File();
	}

	/**
	 * Returns deterministic provider metadata.
	 *
	 * @return array Result metadata.
	 */
	public function jsonSerialize(): array {
		return [
			'provider_metadata' => [
				'provider' => 'e2e-alpha',
				'model'    => 'e2e-image-model',
			],
		];
	}
}

/**
 * Minimal fluent AI Client prompt builder used by the production services.
 */
final class KaiGen_E2E_Prompt_Builder {
	/**
	 * Records prompt text.
	 *
	 * @param string $prompt Prompt text.
	 * @return self
	 */
	public function with_text( $prompt ) {
		return $this;
	}

	/**
	 * Records provider selection.
	 *
	 * @param string $provider Provider identifier.
	 * @return self
	 */
	public function using_provider( $provider ) {
		return $this;
	}

	/**
	 * Handles remaining fluent AI Client configuration methods.
	 *
	 * @param string $name Method name.
	 * @param array  $arguments Method arguments.
	 * @return self
	 */
	public function __call( $name, $arguments ) {
		return $this;
	}

	/**
	 * Reports deterministic image support.
	 *
	 * @return bool True.
	 */
	public function is_supported_for_image_generation() {
		return true;
	}

	/**
	 * Reports deterministic text support.
	 *
	 * @return bool True.
	 */
	public function is_supported_for_text_generation() {
		return true;
	}

	/**
	 * Produces a controlled image result through the real KaiGen service.
	 *
	 * @return KaiGen_E2E_Image_Result|WP_Error Generated result or controlled failure.
	 */
	public function generate_image_result() {
		$payload = $GLOBALS['kaigen_e2e_pending_payload'] ?? [];
		$prompt  = $payload['prompt'] ?? '';
		$state   = kaigen_e2e_get_generation_state();

		$state['request_count'] = (int) $state['request_count'] + 1;
		$state['last_payload']  = $payload;

		if ( $state['delay_ms'] > 0 ) {
			usleep( (int) $state['delay_ms'] * 1000 );
		}

		if ( $prompt === $state['failure_prompt'] && $state['failures_remaining'] > 0 ) {
			$state['failures_remaining'] = (int) $state['failures_remaining'] - 1;
			kaigen_e2e_set_generation_state( $state );

			return new WP_Error( 'e2e_generation_failed', 'E2E mocked generation failure.', [ 'status' => 500 ] );
		}

		kaigen_e2e_set_generation_state( $state );

		return new KaiGen_E2E_Image_Result();
	}

}

/**
 * Creates the deterministic AI Client prompt builder.
 *
 * @return KaiGen_E2E_Prompt_Builder Prompt builder.
 */
function kaigen_e2e_prompt_factory() {
	return new KaiGen_E2E_Prompt_Builder();
}

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'kaigen-e2e/v1',
			'/generation-control',
			[
				[
					'methods'             => WP_REST_Server::CREATABLE,
					'permission_callback' => function () {
						return current_user_can( 'upload_files' );
					},
					'callback'            => function ( $request ) {
						$state = [
							'request_count'      => 0,
							'last_payload'       => null,
							'failure_prompt'     => sanitize_textarea_field( (string) $request->get_param( 'failure_prompt' ) ),
							'failures_remaining' => max( 0, absint( $request->get_param( 'failures_remaining' ) ) ),
							'delay_ms'           => min( 5000, max( 0, absint( $request->get_param( 'delay_ms' ) ) ) ),
						];

						kaigen_e2e_set_generation_state( $state );

						return rest_ensure_response( $state );
					},
				],
				[
					'methods'             => WP_REST_Server::READABLE,
					'permission_callback' => function () {
						return current_user_can( 'upload_files' );
					},
					'callback'            => function () {
						return rest_ensure_response( kaigen_e2e_get_generation_state() );
					},
				],
			]
		);
	}
);

add_filter(
	'rest_request_before_callbacks',
	function ( $response, $handler, $request ) {
		if ( ! defined( 'E2E_TESTING' ) || ! E2E_TESTING ) {
			return $response;
		}

		$route = $request->get_route();
		if ( '/kaigen/v1/generate-image' !== $route ) {
			return $response;
		}


		$GLOBALS['kaigen_e2e_pending_payload'] = [
			'prompt'           => sanitize_textarea_field( (string) $request->get_param( 'prompt' ) ),
			'provider'         => sanitize_text_field( (string) $request->get_param( 'provider' ) ),
			'orientation'      => sanitize_text_field( (string) $request->get_param( 'orientation' ) ),
			'source_image_ids' => array_values( array_map( 'absint', (array) $request->get_param( 'source_image_ids' ) ) ),
		];

		return $response;
	},
	10,
	3
);

add_filter(
	'kaigen_ai_client_available',
	function ( $available ) {
		return defined( 'E2E_TESTING' ) && E2E_TESTING ? true : $available;
	}
);

add_filter(
	'kaigen_ai_client_prompt_factory',
	function ( $factory ) {
		return defined( 'E2E_TESTING' ) && E2E_TESTING ? 'kaigen_e2e_prompt_factory' : $factory;
	}
);
