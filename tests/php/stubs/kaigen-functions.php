<?php
/**
 * WordPress function stubs for KaiGen service tests.
 *
 * @package KaiGen
 */

namespace KaiGen;

$GLOBALS['kaigen_test_hooks']        = [];
$GLOBALS['kaigen_test_curl_options'] = [];

if ( ! function_exists( __NAMESPACE__ . '\\absint' ) ) {
	/**
	 * Returns a positive test integer.
	 *
	 * @param mixed $value Raw value.
	 * @return int Positive integer.
	 */
	function absint( $value ) {
		return abs( (int) $value );
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\add_filter' ) ) {
	/**
	 * Registers a test filter callback.
	 *
	 * @param string   $hook_name Hook name.
	 * @param callable $callback Hook callback.
	 * @param int      $priority Hook priority.
	 * @param int      $accepted_args Accepted argument count.
	 * @return true
	 */
	function add_filter( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
		$GLOBALS['kaigen_test_hooks'][ $hook_name ][ $priority ][] = [
			'callback'      => $callback,
			'accepted_args' => $accepted_args,
		];
		return true;
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\remove_filter' ) ) {
	/**
	 * Unregisters a test filter callback.
	 *
	 * @param string   $hook_name Hook name.
	 * @param callable $callback Hook callback.
	 * @param int      $priority Hook priority.
	 * @return bool Whether a callback was removed.
	 */
	function remove_filter( $hook_name, $callback, $priority = 10 ) {
		if ( empty( $GLOBALS['kaigen_test_hooks'][ $hook_name ][ $priority ] ) ) {
			return false;
		}

		foreach ( $GLOBALS['kaigen_test_hooks'][ $hook_name ][ $priority ] as $index => $registered ) {
			if ( $registered['callback'] === $callback ) {
				unset( $GLOBALS['kaigen_test_hooks'][ $hook_name ][ $priority ][ $index ] );
				return true;
			}
		}

		return false;
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\add_action' ) ) {
	/**
	 * Registers a test action callback.
	 *
	 * @param string   $hook_name Hook name.
	 * @param callable $callback Hook callback.
	 * @param int      $priority Hook priority.
	 * @param int      $accepted_args Accepted argument count.
	 * @return true
	 */
	function add_action( $hook_name, $callback, $priority = 10, $accepted_args = 1 ) {
		return add_filter( $hook_name, $callback, $priority, $accepted_args );
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\remove_action' ) ) {
	/**
	 * Unregisters a test action callback.
	 *
	 * @param string   $hook_name Hook name.
	 * @param callable $callback Hook callback.
	 * @param int      $priority Hook priority.
	 * @return bool Whether a callback was removed.
	 */
	function remove_action( $hook_name, $callback, $priority = 10 ) {
		return remove_filter( $hook_name, $callback, $priority );
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\curl_setopt' ) ) {
	/**
	 * Records a test cURL option.
	 *
	 * @param mixed $handle cURL handle.
	 * @param int   $option cURL option.
	 * @param mixed $value cURL option value.
	 * @return true
	 */
	function curl_setopt( $handle, $option, $value ) {
		unset( $handle );
		$GLOBALS['kaigen_test_curl_options'][ $option ] = $value;
		return true;
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\sanitize_key' ) ) {
	/**
	 * Sanitizes a test request key.
	 *
	 * @param string $value Raw value.
	 * @return string Sanitized value.
	 */
	function sanitize_key( $value ) {
		return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', $value ) );
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\apply_filters' ) ) {
	/**
	 * Returns the unmodified test filter value.
	 *
	 * @param string $hook_name Filter name.
	 * @param mixed  $value Filter value.
	 * @return mixed Filter value.
	 */
	function apply_filters( $hook_name, $value ) {
		return $value;
	}
}

if ( ! function_exists( __NAMESPACE__ . '\\__' ) ) {
	/**
	 * Returns an untranslated test string.
	 *
	 * @param string $text Text to translate.
	 * @return string Original text.
	 */
	function __( $text ) {
		return $text;
	}
}
