<?php
/**
 * Resettable WordPress and AI Client test doubles.
 *
 * @package KaiGen
 */

// phpcs:disable -- Test doubles intentionally declare WordPress global APIs and multiple lightweight boundary objects.

namespace KaiGen\Tests\PHP\Support {

/**
 * Shared state for the handwritten boundary doubles.
 */
final class WordPress_Stub_State {
	/**
	 * Registered hooks.
	 *
	 * @var array
	 */
	public static $hooks = [];

	/**
	 * Hook registration/removal calls.
	 *
	 * @var array
	 */
	public static $hook_calls = [];

	/** @var array Recorded cURL options. */
	public static $curl_options = [];

	/**
	 * Registered REST routes.
	 *
	 * @var array
	 */
	public static $routes = [];

	/**
	 * Capability results.
	 *
	 * @var array
	 */
	public static $capabilities = [];

	/**
	 * Attached file paths by ID.
	 *
	 * @var array
	 */
	public static $attached_files = [];

	/**
	 * Queued image generation results.
	 *
	 * @var array
	 */
	public static $image_results = [];

	/**
	 * Queued text generation results.
	 *
	 * @var array
	 */
	public static $text_results = [];

	/**
	 * Whether image generation is supported.
	 *
	 * @var bool
	 */
	public static $image_supported = true;

	/**
	 * Whether text generation is supported.
	 *
	 * @var bool
	 */
	public static $text_supported = true;

	/**
	 * Builder calls.
	 *
	 * @var array
	 */
	public static $builder_calls = [];

	/**
	 * Resets all mutable fake state.
	 *
	 * @return void
	 */
	public static function reset() {
		self::$curl_options   = [];
		self::$hooks          = [];
		self::$hook_calls     = [];
		self::$routes         = [];
		self::$capabilities   = [];
		self::$attached_files = [];
		self::$image_results  = [];
		self::$text_results   = [];
		self::$image_supported = true;
		self::$text_supported  = true;
		self::$builder_calls   = [];
	}
}

/**
 * Fluent fake for the small AI Client surface used by KaiGen.
 */
final class AI_Client_Prompt_Stub {
	/**
	 * Records an arbitrary fluent method call.
	 *
	 * @param string $name Method name.
	 * @param array  $arguments Method arguments.
	 * @return self
	 */
	public function __call( $name, $arguments ) {
		WordPress_Stub_State::$builder_calls[] = [ $name, $arguments ];
		return $this;
	}

	/**
	 * Reports image support.
	 *
	 * @return bool
	 */
	public function is_supported_for_image_generation() {
		return WordPress_Stub_State::$image_supported;
	}

	/**
	 * Generates the next queued image result.
	 *
	 * @return mixed
	 * @throws \Throwable Queued provider exception.
	 */
	public function generate_image_result() {
		WordPress_Stub_State::$builder_calls[] = [ 'generate_image_result', [] ];
		$result = array_shift( WordPress_Stub_State::$image_results );
		if ( $result instanceof \Throwable ) {
			throw $result;
		}
		return $result;
	}

	/**
	 * Reports text support.
	 *
	 * @return bool
	 */
	public function is_supported_for_text_generation() {
		return WordPress_Stub_State::$text_supported;
	}

	/**
	 * Generates the next queued text result.
	 *
	 * @return mixed
	 * @throws \Throwable Queued provider exception.
	 */
	public function generate_text() {
		$result = array_shift( WordPress_Stub_State::$text_results );
		if ( $result instanceof \Throwable ) {
			throw $result;
		}
		return $result;
	}
}
}

namespace {
	use KaiGen\Tests\PHP\Support\AI_Client_Prompt_Stub;
	use KaiGen\Tests\PHP\Support\WordPress_Stub_State;

	class WP_Error {
		private $code;
		private $message;
		private $data;

		public function __construct( $code = '', $message = '', $data = [] ) {
			$this->code    = $code;
			$this->message = $message;
			$this->data    = $data;
		}

		public function get_error_code() {
			return $this->code;
		}

		public function get_error_message() {
			return $this->message;
		}

		public function get_error_data() {
			return $this->data;
		}
	}

	class WP_REST_Request {
		private $params;

		public function __construct( $params = [] ) {
			$this->params = $params;
		}

		public function get_param( $name ) {
			return $this->params[ $name ] ?? null;
		}
	}

	class WP_REST_Response {
		private $data;

		public function __construct( $data ) {
			$this->data = $data;
		}

		public function get_data() {
			return $this->data;
		}
	}

	class WP_REST_Server {
		public const READABLE  = 'GET';
		public const CREATABLE = 'POST';
	}

	class WP_Query {
		/**
		 * Query results.
		 *
		 * @var array<int, object{ID: int}>
		 */
		public $posts = [];

		public function __construct( $arguments = [] ) {
			unset( $arguments );
		}
	}

	function kaigen_test_callback_id( $callback ) {
		if ( is_array( $callback ) ) {
			$owner = is_object( $callback[0] ) ? spl_object_hash( $callback[0] ) : $callback[0];
			return $owner . '::' . $callback[1];
		}
		return is_object( $callback ) ? spl_object_hash( $callback ) : (string) $callback;
	}

	function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
		$id = kaigen_test_callback_id( $callback );
		WordPress_Stub_State::$hooks[ $hook ][ $priority ][ $id ] = [ $callback, $accepted_args ];
		WordPress_Stub_State::$hook_calls[] = [ 'add', $hook, $id, $priority, $accepted_args ];
		return true;
	}

	function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
		return add_filter( $hook, $callback, $priority, $accepted_args );
	}

	function remove_filter( $hook, $callback, $priority = 10 ) {
		$id = kaigen_test_callback_id( $callback );
		unset( WordPress_Stub_State::$hooks[ $hook ][ $priority ][ $id ] );
		WordPress_Stub_State::$hook_calls[] = [ 'remove', $hook, $id, $priority ];
		return true;
	}

	function remove_action( $hook, $callback, $priority = 10 ) {
		return remove_filter( $hook, $callback, $priority );
	}

	function apply_filters( $hook, $value, ...$arguments ) {
		if ( empty( WordPress_Stub_State::$hooks[ $hook ] ) ) {
			return $value;
		}
		ksort( WordPress_Stub_State::$hooks[ $hook ] );
		foreach ( WordPress_Stub_State::$hooks[ $hook ] as $callbacks ) {
			foreach ( $callbacks as [ $callback, $accepted_args ] ) {
				$value = call_user_func_array( $callback, array_slice( [ $value, ...$arguments ], 0, $accepted_args ) );
			}
		}
		return $value;
	}

	function do_action( $hook, ...$arguments ) {
		apply_filters( $hook, null, ...$arguments );
	}

	function register_rest_route( $namespace, $route, $arguments ) {
		WordPress_Stub_State::$routes[] = [ $namespace, $route, $arguments ];
		return true;
	}

	function current_user_can( $capability, ...$arguments ) {
		$key = $capability . ( empty( $arguments ) ? '' : ':' . implode( ':', $arguments ) );
		return WordPress_Stub_State::$capabilities[ $key ] ?? WordPress_Stub_State::$capabilities[ $capability ] ?? false;
	}

	function wp_ai_client_prompt( ...$arguments ) {
		WordPress_Stub_State::$builder_calls[] = [ 'wp_ai_client_prompt', $arguments ];
		return new AI_Client_Prompt_Stub();
	}

	function is_wp_error( $value ) {
		return $value instanceof WP_Error;
	}

	function rest_ensure_response( $value ) {
		return $value instanceof WP_REST_Response ? $value : new WP_REST_Response( $value );
	}

	function __( $text, $domain = 'default' ) {
		unset( $domain );
		return $text;
	}

	function absint( $value ) {
		return abs( (int) $value );
	}

	function sanitize_key( $value ) {
		return preg_replace( '/[^a-z0-9_\\-]/', '', strtolower( (string) $value ) );
	}

	function sanitize_text_field( $value ) {
		return trim( strip_tags( (string) $value ) );
	}

	function sanitize_textarea_field( $value ) {
		return trim( strip_tags( (string) $value ) );
	}

	function wp_json_encode( $value ) {
		return json_encode( $value );
	}

	function get_attached_file( $attachment_id ) {
		return WordPress_Stub_State::$attached_files[ $attachment_id ] ?? false;
	}

	function wp_check_filetype( $path ) {
		return [ 'type' => 'image/png' ];
	}

	function media_handle_sideload( $file, $post_id, $description ) {
		unset( $file, $post_id, $description );
		return 1;
	}

	function wp_delete_file( $path ) {
		unset( $path );
		return true;
	}

	function wp_update_post( $post ) {
		return $post['ID'] ?? 0;
	}

	function wp_strip_all_tags( $text ) {
		return strip_tags( (string) $text );
	}

	function update_post_meta( $post_id, $key, $value ) {
		unset( $post_id, $key, $value );
		return true;
	}

	function wp_get_attachment_url( $attachment_id ) {
		return 'https://example.test/media/' . absint( $attachment_id );
	}

	function download_url( $url, $timeout = 300 ) {
		unset( $url, $timeout );
		return '/tmp/kaigen-downloaded-image';
	}

	function wp_get_image_mime( $file ) {
		unset( $file );
		return 'image/png';
	}

	function wp_tempnam( $filename = '' ) {
		unset( $filename );
		return '/tmp/kaigen-generated-image';
	}

	function sanitize_title( $title ) {
		$title = strtolower( trim( (string) $title ) );
		return trim( preg_replace( '/[^a-z0-9]+/', '-', $title ), '-' );
	}

	function wp_trim_words( $text, $number = 55, $more = null ) {
		unset( $number, $more );
		return (string) $text;
	}

	function wp_date( $format ) {
		unset( $format );
		return '1/1/2000';
	}

	function wp_get_attachment_image_src( $attachment_id, $size = 'thumbnail' ) {
		unset( $size );
		return [ wp_get_attachment_url( $attachment_id ), 1, 1, true ];
	}

	function get_post_meta( $post_id, $key = '', $single = false ) {
		unset( $post_id, $key, $single );
		return '';
	}
}

namespace KaiGen {
	/**
	 * Captures cURL options without performing a network request.
	 *
	 * @param mixed $handle Test handle.
	 * @param int $option cURL option.
	 * @param mixed $value Option value.
	 * @return bool Whether the option was set.
	 */
	function curl_setopt( $handle, $option, $value ) {
		unset( $handle );
		\KaiGen\Tests\PHP\Support\WordPress_Stub_State::$curl_options[ $option ] = $value;
		return true;
	}
}
