#!/usr/bin/env node
/* eslint-disable no-console */

const { spawn } = require( 'node:child_process' );

const { waitForChild } = require( './child-process.js' );
const { findAvailablePort } = require( './run-e2e.js' );

const DEFAULT_PLAYGROUND_BLUEPRINT = '.github/blueprints/e2e-base.json';
const DEFAULT_PLAYGROUND_PORT = 9400;
const PLAYGROUND_PLUGIN_MOUNT = '.:/wordpress/wp-content/plugins/kaigen';

const resolvePlaygroundBlueprint = ( env = process.env ) =>
	env.PLAYGROUND_BLUEPRINT || DEFAULT_PLAYGROUND_BLUEPRINT;

const resolveManualPlaygroundPort = async ( env = process.env ) => {
	if ( env.PLAYGROUND_PORT ) {
		return env.PLAYGROUND_PORT;
	}

	return String(
		await findAvailablePort( {
			preferredPort: DEFAULT_PLAYGROUND_PORT,
		} )
	);
};

const buildPlaygroundServerArgs = ( { port, blueprint, workers } = {} ) => {
	const args = [
		'@wp-playground/cli',
		'server',
		`--mount=${ PLAYGROUND_PLUGIN_MOUNT }`,
		`--blueprint=${ blueprint || DEFAULT_PLAYGROUND_BLUEPRINT }`,
		`--port=${ port || DEFAULT_PLAYGROUND_PORT }`,
	];

	if ( workers ) {
		args.push( `--workers=${ workers }` );
	}

	return args;
};

const startPlayground = async ( env = process.env ) => {
	const port = await resolveManualPlaygroundPort( env );
	const blueprint = resolvePlaygroundBlueprint( env );
	const args = buildPlaygroundServerArgs( {
		port,
		blueprint,
		workers: env.PLAYGROUND_WORKERS,
	} );

	console.log(
		`Starting WordPress Playground on port ${ port } with ${ blueprint }.`
	);

	const child = spawn( 'npx', args, {
		env,
		stdio: 'inherit',
	} );

	return waitForChild( child );
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
	DEFAULT_PLAYGROUND_BLUEPRINT,
	buildPlaygroundServerArgs,
	resolveManualPlaygroundPort,
	resolvePlaygroundBlueprint,
	startPlayground,
};
