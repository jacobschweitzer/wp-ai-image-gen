<?php
/**
 * Enforces line coverage for one risk-selected production file.
 *
 * @package KaiGen
 */

if ( 4 !== $argc ) {
	fwrite( STDERR, "Usage: php scripts/check-php-coverage.php <clover.xml> <file> <minimum-percent>\n" );
	exit( 2 );
}

[ , $report_path, $target_path, $minimum ] = $argv;
$minimum                               = (float) $minimum;

$document = new DOMDocument();
if ( ! $document->load( $report_path ) ) {
	fwrite( STDERR, "Unable to read Clover report: {$report_path}\n" );
	exit( 2 );
}

$normalized_target = str_replace( '\\', '/', $target_path );
$matching_metrics   = null;

foreach ( $document->getElementsByTagName( 'file' ) as $file ) {
	$file_name = str_replace( '\\', '/', $file->getAttribute( 'name' ) );
	if ( ! str_ends_with( $file_name, $normalized_target ) ) {
		continue;
	}

	$metrics = $file->getElementsByTagName( 'metrics' )->item( 0 );
	if ( $metrics instanceof DOMElement ) {
		$matching_metrics = $metrics;
		break;
	}
}

if ( ! $matching_metrics ) {
	fwrite( STDERR, "Coverage target was not found: {$target_path}\n" );
	exit( 1 );
}

$statements         = (int) $matching_metrics->getAttribute( 'statements' );
$covered_statements = (int) $matching_metrics->getAttribute( 'coveredstatements' );
$percentage         = $statements > 0 ? ( 100 * $covered_statements / $statements ) : 0;

printf( "%s line coverage: %.2f%% (minimum %.2f%%)\n", $target_path, $percentage, $minimum );

if ( $percentage < $minimum ) {
	exit( 1 );
}
