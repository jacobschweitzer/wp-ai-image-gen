const assert = require( 'node:assert/strict' );
const net = require( 'node:net' );
const test = require( 'node:test' );

const {
	findAvailablePort,
	resolvePlaygroundPort,
	resolvePlaywrightLaunch,
	resolvePlaywrightArgs,
} = require( './run-e2e.js' );
const {
	applyRuntimeVersions,
	buildPlaygroundServerArgs,
	resolvePlaygroundBlueprint,
	resolvePlaygroundPhpVersion,
	resolvePlaygroundWordPressVersion,
	resolveManualPlaygroundPort,
} = require( './playground-server.js' );

const listenOnPort = async ( port ) =>
	new Promise( ( resolve, reject ) => {
		const server = net.createServer();
		server.once( 'error', reject );
		server.listen( port, '127.0.0.1', () => resolve( server ) );
	} );

const closeServer = async ( server ) =>
	new Promise( ( resolve, reject ) => {
		server.close( ( error ) => {
			if ( error ) {
				reject( error );
				return;
			}
			resolve();
		} );
	} );

test( 'findAvailablePort skips a busy preferred port', async () => {
	const busyServer = await listenOnPort( 9400 );

	try {
		const port = await findAvailablePort( { preferredPort: 9400 } );

		assert.notEqual( port, 9400 );
		assert.equal( Number.isInteger( port ), true );
		assert.equal( port > 9400, true );
	} finally {
		await closeServer( busyServer );
	}
} );

test( 'resolvePlaygroundPort preserves an explicit PLAYGROUND_PORT', async () => {
	const port = await resolvePlaygroundPort( {
		PLAYGROUND_PORT: '9417',
	} );

	assert.equal( port, '9417' );
} );

test( 'resolvePlaygroundPort canonicalizes an explicit port', async () => {
	const port = await resolvePlaygroundPort( {
		PLAYGROUND_PORT: '09417',
	} );

	assert.equal( port, '9417' );
} );

test( 'resolveManualPlaygroundPort skips a busy default port', async () => {
	const busyServer = await listenOnPort( 9400 );

	try {
		const port = await resolveManualPlaygroundPort( {} );

		assert.notEqual( port, '9400' );
		assert.equal( Number.isInteger( Number( port ) ), true );
		assert.equal( Number( port ) > 9400, true );
	} finally {
		await closeServer( busyServer );
	}
} );

test( 'resolveManualPlaygroundPort rejects path-like ports', async () => {
	await assert.rejects(
		resolveManualPlaygroundPort( { PLAYGROUND_PORT: '../../victim' } ),
		/Invalid port/
	);
	await assert.rejects(
		resolveManualPlaygroundPort( { PLAYGROUND_PORT: '70000' } ),
		/Invalid port/
	);
} );

test( 'resolvePlaygroundBlueprint defaults to the base E2E blueprint', () => {
	assert.equal(
		resolvePlaygroundBlueprint( {} ),
		'.github/blueprints/e2e-base.json'
	);
} );

test( 'resolvePlaygroundBlueprint preserves an explicit PLAYGROUND_BLUEPRINT', () => {
	assert.equal(
		resolvePlaygroundBlueprint( {
			PLAYGROUND_BLUEPRINT: '.github/blueprints/e2e-reference-media.json',
		} ),
		'.github/blueprints/e2e-reference-media.json'
	);
} );

test( 'runtime resolvers preserve deterministic blueprint defaults', () => {
	assert.equal( resolvePlaygroundPhpVersion( {} ), '8.1' );
	assert.equal(
		resolvePlaygroundWordPressVersion(
			'.github/blueprints/e2e-ai-client-contract.json',
			{}
		),
		'7.0'
	);
	assert.equal(
		resolvePlaygroundWordPressVersion(
			'.github/blueprints/e2e-base.json',
			{}
		),
		'latest'
	);
} );

test( 'applyRuntimeVersions overrides blueprint worker runtimes', () => {
	assert.deepEqual(
		applyRuntimeVersions(
			{
				preferredVersions: { php: '8.5', wp: 'nightly' },
				steps: [],
			},
			'7.4',
			'7.0'
		),
		{
			preferredVersions: { php: '7.4', wp: '7.0' },
			steps: [],
		}
	);
} );

test( 'buildPlaygroundServerArgs includes port, blueprint, and workers', () => {
	assert.deepEqual(
		buildPlaygroundServerArgs( {
			port: '9411',
			blueprint: '.github/blueprints/e2e-generation-mocked.json',
			workers: 'auto',
		} ),
		[
			'exec',
			'--prefix',
			'tests/e2e',
			'--',
			'wp-playground-cli',
			'server',
			'--mount=.:/wordpress/wp-content/plugins/kaigen',
			'--blueprint=.github/blueprints/e2e-generation-mocked.json',
			'--port=9411',
			'--workers=auto',
		]
	);
} );

test( 'buildPlaygroundServerArgs applies runtime compatibility overrides', () => {
	const args = buildPlaygroundServerArgs( {
		port: '9412',
		blueprint: '.github/blueprints/e2e-base.json',
		phpVersion: '7.4',
		wordpressVersion: '7.0',
	} );

	assert.equal( args.includes( '--php=7.4' ), true );
	assert.equal( args.includes( '--wp=7.0' ), true );
} );

test( 'resolvePlaywrightLaunch strips playground blueprint flags', () => {
	const launch = resolvePlaywrightLaunch(
		[
			'--playground-blueprint=.github/blueprints/e2e-reference-media.json',
			'--grep',
			'@reference',
		],
		{}
	);

	assert.deepEqual( launch.args, [ '--grep', '@reference' ] );
	assert.equal(
		launch.env.PLAYGROUND_BLUEPRINT,
		'.github/blueprints/e2e-reference-media.json'
	);
} );

test( 'resolvePlaywrightLaunch strips playground workers flags', () => {
	const launch = resolvePlaywrightLaunch(
		[ '--playground-workers', 'auto', '--grep', '@smoke' ],
		{}
	);

	assert.deepEqual( launch.args, [ '--grep', '@smoke' ] );
	assert.equal( launch.env.PLAYGROUND_WORKERS, 'auto' );
} );

test( 'resolvePlaywrightLaunch isolates named artifacts', () => {
	const launch = resolvePlaywrightLaunch(
		[ '--artifact-name=generation', '--grep', '@generation' ],
		{}
	);

	assert.deepEqual( launch.args, [ '--grep', '@generation' ] );
	assert.equal( launch.env.PLAYWRIGHT_ARTIFACT_NAME, 'generation' );
} );

test( 'resolvePlaywrightLaunch rejects unsafe artifact names', () => {
	assert.throws(
		() => resolvePlaywrightLaunch( [ '--artifact-name=../shared' ], {} ),
		/Invalid artifact name/
	);
} );

test( 'resolvePlaywrightArgs defaults to the dedicated E2E config', () => {
	const args = resolvePlaywrightArgs( [ '--project=chromium' ] );

	assert.deepEqual( args.slice( 0, 2 ), [
		'--config',
		'tests/e2e/playwright.config.ts',
	] );
	assert.deepEqual( args.slice( 2 ), [ '--project=chromium' ] );
} );

test( 'resolvePlaywrightArgs preserves an explicit config', () => {
	const args = [ '--config=custom.config.ts', '--project=chromium' ];

	assert.deepEqual( resolvePlaywrightArgs( args ), args );
} );

test( 'resolvePlaywrightArgs preserves a short explicit config', () => {
	const args = [ '-c=custom.config.ts', '--project=chromium' ];

	assert.deepEqual( resolvePlaywrightArgs( args ), args );
} );
