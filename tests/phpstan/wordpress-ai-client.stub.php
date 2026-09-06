<?php
/**
 * Minimal static-analysis signatures for the WordPress 7.0 AI Client boundary.
 *
 * The real API contract is checked separately in WordPress Playground.
 *
 * @package KaiGen
 */

namespace WordPress\AiClient {
	final class AiClient {
		/** @return Registry */
		public static function defaultRegistry() {}
	}

	final class Registry {
		/** @return array<int, string> */
		public function getRegisteredProviderIds() {}

		/** @return array<mixed> */
		public function findProviderModelsMetadataForSupport( string $provider_id, object $requirements ) {}

		/** @return class-string */
		public function getProviderClassName( string $provider_id ) {}
	}
}

namespace WordPress\AiClient\Providers\Models\DTO {
	final class ModelRequirements {
		/**
		 * @param array<mixed> $capabilities Required capabilities.
		 * @param array<mixed> $options Required options.
		 */
		public function __construct( array $capabilities, array $options ) {}
	}
}

namespace WordPress\AiClient\Providers\Models\Enums {
	final class CapabilityEnum {
		/** @return mixed */
		public static function imageGeneration() {}
	}
}
