const assert = require( 'node:assert/strict' );
const { spawnSync } = require( 'node:child_process' );
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require( 'node:fs' );
const { tmpdir } = require( 'node:os' );
const path = require( 'node:path' );
const test = require( 'node:test' );

const { getDirtyBuildArtifacts } = require( './check-build-parity.js' );

const runGit = ( cwd, args ) => {
	const result = spawnSync( 'git', args, {
		cwd,
		encoding: 'utf8',
	} );

	assert.equal(
		result.status,
		0,
		`git ${ args.join( ' ' ) } failed: ${ result.stderr }`
	);
};

const createRepository = ( t ) => {
	const repository = mkdtempSync(
		path.join( tmpdir(), 'kaigen-build-parity-' )
	);
	t.after( () => rmSync( repository, { force: true, recursive: true } ) );

	mkdirSync( path.join( repository, 'build' ), { recursive: true } );
	mkdirSync( path.join( repository, 'premium/plugin/build' ), {
		recursive: true,
	} );
	writeFileSync( path.join( repository, 'build/index.js' ), 'tracked build' );
	writeFileSync(
		path.join( repository, 'premium/plugin/build/index.js' ),
		'tracked premium build'
	);
	runGit( repository, [ 'init', '--quiet' ] );
	runGit( repository, [ 'add', '.' ] );
	runGit( repository, [
		'-c',
		'user.name=KaiGen Tests',
		'-c',
		'user.email=tests@example.com',
		'commit',
		'--quiet',
		'-m',
		'Initial build',
	] );

	return repository;
};

const buildPaths = [ 'build/', 'premium/plugin/build/' ];

test( 'reports modified tracked build artifacts', ( t ) => {
	const repository = createRepository( t );
	writeFileSync( path.join( repository, 'build/index.js' ), 'changed build' );

	assert.deepEqual( getDirtyBuildArtifacts( repository, buildPaths ), [
		'M build/index.js',
	] );
} );

test( 'reports newly generated untracked build artifacts', ( t ) => {
	const repository = createRepository( t );
	writeFileSync( path.join( repository, 'build/new.js' ), 'new build' );

	assert.deepEqual( getDirtyBuildArtifacts( repository, buildPaths ), [
		'?? build/new.js',
	] );
} );

test( 'ignores changes outside configured build directories', ( t ) => {
	const repository = createRepository( t );
	writeFileSync( path.join( repository, 'source.js' ), 'source change' );

	assert.deepEqual( getDirtyBuildArtifacts( repository, buildPaths ), [] );
} );
