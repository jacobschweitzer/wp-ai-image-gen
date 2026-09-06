#!/usr/bin/env node

/* eslint-disable no-console */

const { existsSync, mkdirSync, readFileSync, rmSync } = require( 'node:fs' );
const { spawnSync } = require( 'node:child_process' );
const path = require( 'node:path' );

const {
	PHP_COVERAGE_FLOORS,
	assertCoverageThresholds,
} = require( './php-coverage-threshold.js' );

const repositoryRoot = path.resolve( __dirname, '..' );
const phpUnit = path.join(
	repositoryRoot,
	'vendor',
	'phpunit',
	'phpunit',
	'phpunit'
);
const resultsDirectory = path.join( repositoryRoot, 'tests', 'test-results' );
const cloverFile = path.join( resultsDirectory, 'php-coverage.xml' );
const coverageArguments = [
	phpUnit,
	'--coverage-text',
	'--coverage-clover',
	cloverFile,
	'--fail-on-warning',
];

if ( ! existsSync( phpUnit ) ) {
	console.error( 'PHPUnit is unavailable. Run `composer install` first.' );
	process.exit( 1 );
}

mkdirSync( resultsDirectory, { recursive: true } );
rmSync( cloverFile, { force: true } );

const phpProbe = spawnSync(
	'php',
	[
		'-r',
		'echo extension_loaded("xdebug") ? "xdebug" : (extension_loaded("pcov") ? "pcov" : "none");',
	],
	{ encoding: 'utf8' }
);

if ( phpProbe.error || phpProbe.status !== 0 ) {
	console.error( 'Unable to inspect the PHP coverage extensions.' );
	process.exit( 1 );
}

const requestedDriver = process.env.KAIGEN_PHP_COVERAGE_DRIVER;
const detectedDriver = phpProbe.stdout.trim();
const driver =
	requestedDriver ||
	( detectedDriver === 'none' ? 'phpdbg' : detectedDriver );

let command = 'php';
let commandArguments = coverageArguments;
const environment = { ...process.env };

if ( driver === 'xdebug' ) {
	environment.XDEBUG_MODE = 'coverage';
	commandArguments = [ '-d', 'xdebug.mode=coverage', ...coverageArguments ];
} else if ( driver === 'pcov' ) {
	commandArguments = [ '-d', 'pcov.enabled=1', ...coverageArguments ];
} else if ( driver === 'phpdbg' ) {
	command = process.platform === 'win32' ? 'phpdbg.exe' : 'phpdbg';
	commandArguments = [ '-qrr', ...coverageArguments ];
} else {
	console.error(
		`Unsupported KAIGEN_PHP_COVERAGE_DRIVER value: ${ driver }`
	);
	process.exit( 1 );
}
console.log( `Running PHP coverage with ${ driver }.` );

const result = spawnSync( command, commandArguments, {
	cwd: repositoryRoot,
	env: environment,
	stdio: 'inherit',
} );

if ( result.error?.code === 'ENOENT' ) {
	console.error(
		'No PHP coverage driver is available. Install Xdebug or PCOV, or provide a phpdbg build supported by PHPUnit.'
	);
	process.exit( 1 );
}

if ( result.error || result.status !== 0 ) {
	process.exit( result.status || 1 );
}

if ( ! existsSync( cloverFile ) ) {
	console.error(
		`${ driver } ran PHPUnit but did not produce coverage. Install Xdebug or PCOV, or use a phpdbg/PHPUnit combination with coverage support.`
	);
	process.exit( 1 );
}

try {
	const coverage = assertCoverageThresholds(
		readFileSync( cloverFile, 'utf8' )
	);
	console.log(
		`PHP coverage floors passed: lines ${ coverage.lines.toFixed( 2 ) }%/${
			PHP_COVERAGE_FLOORS.lines
		}%, methods ${ coverage.methods.toFixed( 2 ) }%/${
			PHP_COVERAGE_FLOORS.methods
		}%.`
	);
} catch ( error ) {
	console.error( error.message );
	process.exit( 1 );
}
