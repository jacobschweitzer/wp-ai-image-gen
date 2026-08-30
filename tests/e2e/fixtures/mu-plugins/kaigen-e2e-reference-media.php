<?php
/**
 * Provides reference media fixtures for KaiGen E2E tests.
 *
 * @package KaiGen
 */

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'kaigen-e2e/v1',
			'/ai-client-contract',
			[
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => function () {
					global $wp_version;

					$file_type_class  = 'WordPress\\AiClient\\Files\\Enums\\FileTypeEnum';
					$orientation_class = 'WordPress\\AiClient\\Files\\Enums\\MediaOrientationEnum';
					$factory_available = is_callable( 'wp_ai_client_prompt' );
					$symbols_available = class_exists( $file_type_class ) && class_exists( $orientation_class );
					$request_built     = false;
					$contract_error    = null;

					if ( $factory_available && $symbols_available ) {
						try {
							wp_ai_client_prompt()
								->with_text( 'KaiGen AI Client contract' )
								->as_output_file_type( $file_type_class::inline() )
								->as_output_media_orientation( $orientation_class::from( 'landscape' ) );
							$request_built = true;
						} catch ( Throwable $error ) {
							$contract_error = $error->getMessage();
						}
					}

					return rest_ensure_response(
						[
							'wordpressVersion' => $wp_version,
							'phpVersion'       => PHP_VERSION,
							'factoryAvailable' => $factory_available,
							'symbolsAvailable' => $symbols_available,
							'requestBuilt'     => $request_built,
							'contractError'    => $contract_error,
						]
					);
				},
			]
		);

		register_rest_route(
			'kaigen-e2e/v1',
			'/reference-media',
			[
				'methods'             => 'POST',
				'permission_callback' => function () {
					return current_user_can( 'upload_files' );
				},
				'callback'            => function () {
					$png      = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' );
					$fixtures = [
						[
							'filename' => 'kaigen-reference-marked.png',
							'alt'      => 'KaiGen marked reference fixture',
							'marked'   => true,
						],
						[
							'filename' => 'kaigen-reference-unmarked.png',
							'alt'      => 'KaiGen unmarked image fixture',
							'marked'   => false,
						],
					];
					$created  = [];

					foreach ( $fixtures as $fixture ) {
						$upload = wp_upload_bits( $fixture['filename'], null, $png );

						if ( ! empty( $upload['error'] ) ) {
							return new WP_Error( 'e2e_reference_upload_failed', $upload['error'], [ 'status' => 500 ] );
						}

						$attachment_id = wp_insert_attachment(
							[
								'post_mime_type' => 'image/png',
								'post_title'     => sanitize_text_field( $fixture['alt'] ),
								'post_content'   => '',
								'post_status'    => 'inherit',
							],
							$upload['file']
						);

						if ( is_wp_error( $attachment_id ) ) {
							return $attachment_id;
						}

						update_post_meta( $attachment_id, '_wp_attachment_image_alt', $fixture['alt'] );
						update_post_meta( $attachment_id, 'kaigen_reference_image', $fixture['marked'] ? 1 : 0 );

						$created[] = [
							'id'     => $attachment_id,
							'url'    => wp_get_attachment_url( $attachment_id ),
							'alt'    => $fixture['alt'],
							'marked' => $fixture['marked'],
						];
					}

					return rest_ensure_response( $created );
				},
			]
		);
	}
);
