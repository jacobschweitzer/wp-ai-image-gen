<?php
/**
 * Bootstrap file for KaiGen PHPUnit tests.
 *
 * @package KaiGen
 */

define( 'KAIGEN_TESTS_ROOT', dirname( __DIR__, 2 ) );
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress boundary stub.
define( 'ABSPATH', KAIGEN_TESTS_ROOT . '/tests/php/fixtures/wordpress/' );

require_once __DIR__ . '/Support/WordPressStubs.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-image-handler.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-image-generation-http-options.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-image-generation-service.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-prompt-refinement-service.php';
require_once KAIGEN_TESTS_ROOT . '/inc/class-rest-api.php';
