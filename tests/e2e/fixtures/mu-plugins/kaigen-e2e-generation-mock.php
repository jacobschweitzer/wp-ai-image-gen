<?php
/**
 * Provides a deterministic AI Client boundary for generation E2E tests.
 *
 * @package KaiGen
 */

namespace WordPress\AiClient\Files\Enums {
	if ( ! class_exists( FileTypeEnum::class ) ) {
		/**
		 * Minimal AI Client file-type enum fixture.
		 */
		final class FileTypeEnum {
			/**
			 * Returns the inline output type.
			 *
			 * @return string Inline output type.
			 */
			public static function inline() {
				return 'inline';
			}
		}
	}

	if ( ! class_exists( MediaOrientationEnum::class ) ) {
		/**
		 * Minimal AI Client media-orientation enum fixture.
		 */
		final class MediaOrientationEnum {
			/**
			 * Returns the requested orientation.
			 *
			 * @param string $orientation Requested orientation.
			 * @return string Requested orientation.
			 */
			public static function from( $orientation ) {
				return $orientation;
			}
		}
	}
}

namespace {
	/**
	 * Core-style generated image result.
	 */
	final class KaiGen_E2E_Image_Result implements JsonSerializable {
		/**
		 * Gets the deterministic image file result.
		 *
		 * @return object Image file result.
		 */
		public function to_file() {
			return new class() {
				/**
				 * Gets the deterministic image data URI.
				 *
				 * @return string Image data URI.
				 */
				public function get_data_uri() {
					return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
				}
			};
		}

		/**
		 * Serializes deterministic provider metadata.
		 *
		 * @return array Result metadata.
		 */
		public function jsonSerialize() {
			return [
				'provider_metadata' => [
					'provider' => 'e2e-alpha',
				],
				'model_metadata'    => [
					'model' => 'e2e-image-model',
				],
			];
		}
	}

	/**
	 * Minimal fluent AI Client prompt builder used by the production service.
	 */
	final class KaiGen_E2E_Prompt_Builder {
		/**
		 * Prompt text.
		 *
		 * @var string
		 */
		private $prompt = '';

		/**
		 * Requested output file type.
		 *
		 * @var mixed
		 */
		private $output_file_type;

		/**
		 * Requested output orientation.
		 *
		 * @var mixed
		 */
		private $output_orientation;

		/**
		 * Selected provider.
		 *
		 * @var string|null
		 */
		private $provider;

		/**
		 * Reference files attached to the request.
		 *
		 * @var array
		 */
		private $files = [];

		/**
		 * Whether image-generation support was checked.
		 *
		 * @var bool
		 */
		private $support_checked = false;

		/**
		 * Records prompt text.
		 *
		 * @param string $prompt Prompt text.
		 * @return self
		 */
		public function with_text( $prompt ) {
			$this->prompt = $prompt;
			return $this;
		}

		/**
		 * Records the requested output file type.
		 *
		 * @param mixed $file_type Output file type.
		 * @return self
		 */
		public function as_output_file_type( $file_type ) {
			$this->output_file_type = json_decode( wp_json_encode( $file_type ), true );
			return $this;
		}

		/**
		 * Records the requested output orientation.
		 *
		 * @param mixed $orientation Output orientation.
		 * @return self
		 */
		public function as_output_media_orientation( $orientation ) {
			$this->output_orientation = json_decode( wp_json_encode( $orientation ), true );
			return $this;
		}

		/**
		 * Records provider selection.
		 *
		 * @param string $provider Provider identifier.
		 * @return self
		 */
		public function using_provider( $provider ) {
			$this->provider = $provider;
			return $this;
		}

		/**
		 * Records a reference file.
		 *
		 * @param string      $file_path Reference file path.
		 * @param string|null $mime_type Reference file MIME type.
		 * @return self
		 */
		public function with_file( $file_path, $mime_type ) {
			$this->files[] = [
				'basename'  => basename( $file_path ),
				'mime_type' => $mime_type,
			];
			return $this;
		}

		/**
		 * Reports deterministic image support.
		 *
		 * @return bool True.
		 */
		public function is_supported_for_image_generation() {
			$this->support_checked = true;
			return true;
		}

		/**
		 * Produces a controlled image result after validating request construction.
		 *
		 * @return KaiGen_E2E_Image_Result|WP_Error Generated result or request mismatch.
		 */
		public function generate_image_result() {
			$has_expected_reference = 1 === count( $this->files )
				&& 1 === preg_match( '/^kaigen-reference-marked(?:-\d+)?\.png$/', $this->files[0]['basename'] )
				&& 'image/png' === $this->files[0]['mime_type'];

			if (
				'subject' !== $this->prompt ||
				'inline' !== $this->output_file_type ||
				'square' !== $this->output_orientation ||
				null !== $this->provider ||
				! $this->support_checked ||
				! $has_expected_reference
			) {
				return new WP_Error(
					'e2e_generation_request_mismatch',
					'KaiGen did not construct the expected AI Client request: ' . wp_json_encode(
						[
							'prompt'             => $this->prompt,
							'output_file_type'   => $this->output_file_type,
							'output_orientation' => $this->output_orientation,
							'provider'           => $this->provider,
							'support_checked'    => $this->support_checked,
							'files'              => $this->files,
						]
					),
					[ 'status' => 500 ]
				);
			}

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

	add_filter(
		'kaigen_ai_client_prompt_factory',
		function ( $factory ) {
			return defined( 'E2E_TESTING' ) && E2E_TESTING ? 'kaigen_e2e_prompt_factory' : $factory;
		}
	);
}
