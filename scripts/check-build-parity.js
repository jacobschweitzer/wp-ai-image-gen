#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require( 'node:child_process' );

const BUILD_PATHS = [ 'build/' ];

const getDirtyBuildArtifacts = (
	cwd = process.cwd(),
	buildPaths = BUILD_PATHS
) => {
	const result = spawnSync(
		'git',
		[
			'status',
			'--porcelain=v1',
			'--untracked-files=all',
			'--',
			...buildPaths,
		],
		{
			cwd,
			encoding: 'utf8',
		}
	);

	if ( result.error ) {
		throw result.error;
	}

	if ( result.status !== 0 ) {
		throw new Error(
			result.stderr.trim() ||
				`git status exited with code ${ result.status }.`
		);
	}

	return result.stdout
		.split( /\r?\n/ )
		.map( ( line ) => line.trim() )
		.filter( Boolean );
};

const checkBuildParity = ( cwd = process.cwd() ) => {
	const dirtyArtifacts = getDirtyBuildArtifacts( cwd );

	if ( dirtyArtifacts.length === 0 ) {
		return true;
	}

	console.error( 'Generated build artifacts do not match the repository:' );
	for ( const artifact of dirtyArtifacts ) {
		console.error( `  ${ artifact }` );
	}

	return false;
};

if ( require.main === module ) {
	try {
		process.exitCode = checkBuildParity() ? 0 : 1;
	} catch ( error ) {
		console.error( error.message );
		process.exitCode = 1;
	}
}

module.exports = {
	BUILD_PATHS,
	checkBuildParity,
	getDirtyBuildArtifacts,
};
