#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require( 'node:child_process' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );

const { waitForChild } = require( './child-process.js' );
const { findAvailablePort, normalizePort } = require( './run-e2e.js' );

const DEFAULT_PLAYGROUND_BLUEPRINT = '.github/blueprints/e2e-base.json';
const DEFAULT_PLAYGROUND_PORT = 9400;
const DEFAULT_PLAYGROUND_WORKERS = '6';
const DEFAULT_PLAYGROUND_PHP_VERSION = '8.1';
const DEFAULT_PLAYGROUND_WP_VERSION = 'latest';
const CONTRACT_PLAYGROUND_WP_VERSION = '7.0';
const PLAYGROUND_PLUGIN_MOUNT = '.:/wordpress/wp-content/plugins/kaigen';

const resolvePlaygroundBlueprint = ( env = process.env ) =>
	env.PLAYGROUND_BLUEPRINT || DEFAULT_PLAYGROUND_BLUEPRINT;

const resolvePlaygroundPhpVersion = ( env = process.env ) =>
	env.PLAYGROUND_PHP_VERSION || DEFAULT_PLAYGROUND_PHP_VERSION;

const resolvePlaygroundWordPressVersion = ( blueprint, env = process.env ) =>
	env.PLAYGROUND_WP_VERSION ||
	( blueprint.endsWith( 'e2e-ai-client-contract.json' )
		? CONTRACT_PLAYGROUND_WP_VERSION
		: DEFAULT_PLAYGROUND_WP_VERSION );

const applyRuntimeVersions = ( blueprint, phpVersion, wordpressVersion ) => ( {
	...blueprint,
	preferredVersions: {
		...( blueprint.preferredVersions || {} ),
		php: phpVersion,
		wp: wordpressVersion,
	},
} );

const materializePlaygroundBlueprint = (
	blueprintPath,
	phpVersion,
	wordpressVersion,
	runtimeDirectory = os.tmpdir()
) => {
	const sourcePath = path.resolve( blueprintPath );
	const blueprint = JSON.parse( fs.readFileSync( sourcePath, 'utf8' ) );
	const temporaryDirectory = fs.mkdtempSync(
		path.join( runtimeDirectory, 'kaigen-playground-' )
	);
	const runtimeBlueprintPath = path.join(
		temporaryDirectory,
		path.basename( sourcePath )
	);

	try {
		fs.writeFileSync(
			runtimeBlueprintPath,
			JSON.stringify(
				applyRuntimeVersions( blueprint, phpVersion, wordpressVersion ),
				null,
				2
			)
		);
	} catch ( error ) {
		fs.rmSync( temporaryDirectory, { recursive: true, force: true } );
		throw error;
	}

	return {
		path: runtimeBlueprintPath,
		cleanup: () =>
			fs.rmSync( temporaryDirectory, { recursive: true, force: true } ),
	};
};

const resolveManualPlaygroundPort = async ( env = process.env ) => {
	if ( env.PLAYGROUND_PORT ) {
		return String( normalizePort( env.PLAYGROUND_PORT ) );
	}

	return String(
		await findAvailablePort( {
			preferredPort: DEFAULT_PLAYGROUND_PORT,
		} )
	);
};

const buildPlaygroundServerArgs = ( {
	port,
	blueprint,
	workers,
	phpVersion,
	wordpressVersion,
} = {} ) => {
	const args = [
		'exec',
		'--prefix',
		'tests/e2e',
		'--',
		'wp-playground-cli',
		'server',
		`--mount=${ PLAYGROUND_PLUGIN_MOUNT }`,
		`--blueprint=${ blueprint || DEFAULT_PLAYGROUND_BLUEPRINT }`,
		`--port=${ port || DEFAULT_PLAYGROUND_PORT }`,
	];

	if ( workers ) {
		args.push( `--workers=${ workers }` );
	}
	if ( phpVersion ) {
		args.push( `--php=${ phpVersion }` );
	}
	if ( wordpressVersion ) {
		args.push( `--wp=${ wordpressVersion }` );
	}

	return args;
};

const startPlayground = async ( env = process.env ) => {
	const port = await resolveManualPlaygroundPort( env );
	const blueprint = resolvePlaygroundBlueprint( env );
	const phpVersion = resolvePlaygroundPhpVersion( env );
	const wordpressVersion = resolvePlaygroundWordPressVersion(
		blueprint,
		env
	);
	const runtimeBlueprint = materializePlaygroundBlueprint(
		blueprint,
		phpVersion,
		wordpressVersion,
		env.PLAYGROUND_RUNTIME_DIRECTORY
	);
	const args = buildPlaygroundServerArgs( {
		port,
		blueprint: runtimeBlueprint.path,
		workers: env.PLAYGROUND_WORKERS || DEFAULT_PLAYGROUND_WORKERS,
		phpVersion,
		wordpressVersion,
	} );

	console.log(
		`Starting WordPress Playground on port ${ port } with ${ blueprint }.`
	);

	try {
		const child = spawn( 'npm', args, {
			env,
			stdio: 'inherit',
		} );

		return await waitForChild( child );
	} finally {
		runtimeBlueprint.cleanup();
	}
};

if ( require.main === module ) {
	startPlayground()
		.then( ( exitCode ) => {
			process.exitCode = exitCode;
		} )
		.catch( ( error ) => {
			console.error( error.message );
			process.exitCode = 1;
		} );
}

module.exports = {
	applyRuntimeVersions,
	buildPlaygroundServerArgs,
	materializePlaygroundBlueprint,
	resolveManualPlaygroundPort,
	resolvePlaygroundBlueprint,
	resolvePlaygroundPhpVersion,
	resolvePlaygroundWordPressVersion,
	startPlayground,
};
