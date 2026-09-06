const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const { EventEmitter } = require( 'node:events' );
const net = require( 'node:net' );
const test = require( 'node:test' );
const os = require( 'node:os' );
const path = require( 'node:path' );

const {
	findAvailablePort,
	resolvePlaygroundPort,
	resolvePlaywrightLaunch,
	resolvePlaywrightArgs,
	runPlaywright,
} = require( './run-e2e.js' );
const {
	applyRuntimeVersions,
	materializePlaygroundBlueprint,
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
	const busyServer = await listenOnPort( 0 );
	const busyPort = busyServer.address().port;

	try {
		const port = await findAvailablePort( { preferredPort: busyPort } );

		assert.notEqual( port, busyPort );
		assert.equal( Number.isInteger( port ), true );
		assert.equal( port > busyPort, true );
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

test( 'resolveManualPlaygroundPort selects an available port at or above the default', async () => {
	const port = Number( await resolveManualPlaygroundPort( {} ) );
	assert.equal( Number.isInteger( port ), true );
	assert.ok( port >= 9400 );
	const server = await listenOnPort( port );
	await closeServer( server );
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

test( 'resolvePlaywrightLaunch rejects missing option values', () => {
	for ( const option of [
		'--artifact-name',
		'--playground-blueprint',
		'--playground-workers',
	] ) {
		for ( const args of [
			[ option ],
			[ `${ option }=` ],
			[ option, '--grep' ],
		] ) {
			assert.throws(
				() => resolvePlaywrightLaunch( args, {} ),
				/requires a value/
			);
		}
	}
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

test( 'runtime blueprints clean up independently', ( t ) => {
	const sourceDirectory = fs.mkdtempSync(
		path.join( os.tmpdir(), 'kaigen-blueprint-test-' )
	);
	t.after( () =>
		fs.rmSync( sourceDirectory, { recursive: true, force: true } )
	);
	const sourcePath = path.join( sourceDirectory, 'blueprint.json' );
	fs.writeFileSync( sourcePath, JSON.stringify( { steps: [] } ) );
	const first = materializePlaygroundBlueprint(
		sourcePath,
		'8.1',
		'7.0',
		sourceDirectory
	);
	t.after( first.cleanup );
	const second = materializePlaygroundBlueprint(
		sourcePath,
		'7.4',
		'7.0',
		sourceDirectory
	);
	t.after( second.cleanup );
	assert.notEqual( first.path, second.path );
	assert.deepEqual(
		JSON.parse( fs.readFileSync( first.path, 'utf8' ) ).preferredVersions,
		{ php: '8.1', wp: '7.0' }
	);
	first.cleanup();
	assert.equal( fs.existsSync( second.path ), true );
} );

test( 'attached server runs preserve the external runtime directory', async ( t ) => {
	const externalDirectory = fs.mkdtempSync(
		path.join( os.tmpdir(), 'kaigen-external-test-' )
	);
	t.after( () =>
		fs.rmSync( externalDirectory, { recursive: true, force: true } )
	);
	const sentinel = path.join( externalDirectory, 'blueprint.json' );
	fs.writeFileSync( sentinel, '{}' );
	const removeDirectory = t.mock.method( fs, 'rmSync' );
	const createDirectory = t.mock.method( fs, 'mkdtempSync' );
	const result = await runPlaywright(
		[],
		{
			PLAYGROUND_PORT: '9417',
			PLAYWRIGHT_SKIP_WEBSERVER: '1',
			PLAYGROUND_RUNTIME_DIRECTORY: externalDirectory,
		},
		{
			resolveCli: () => 'playwright-cli',
			spawnChild: ( command, args, { env } ) => {
				assert.equal(
					env.PLAYGROUND_RUNTIME_DIRECTORY,
					externalDirectory
				);
				assert.deepEqual( fs.readdirSync( externalDirectory ), [
					'blueprint.json',
				] );
				const child = new EventEmitter();
				process.nextTick( () => child.emit( 'exit', 0, null ) );
				return child;
			},
		}
	);
	assert.equal( result, 0 );
	assert.equal( removeDirectory.mock.callCount(), 0 );
	assert.equal( createDirectory.mock.callCount(), 0 );
	assert.equal( fs.readFileSync( sentinel, 'utf8' ), '{}' );
} );

test( 'launcher removes its owned runtime directory after a child failure', async () => {
	let runtimeDirectory;
	const result = await runPlaywright(
		[],
		{ PLAYGROUND_PORT: '9417' },
		{
			resolveCli: () => 'playwright-cli',
			spawnChild: ( command, args, { env } ) => {
				runtimeDirectory = env.PLAYGROUND_RUNTIME_DIRECTORY;
				assert.equal( fs.existsSync( runtimeDirectory ), true );
				fs.writeFileSync(
					path.join( runtimeDirectory, 'leftover.json' ),
					'{}'
				);
				const child = new EventEmitter();
				process.nextTick( () => child.emit( 'exit', 1, null ) );
				return child;
			},
		}
	);
	assert.equal( result, 1 );
	assert.equal( fs.existsSync( runtimeDirectory ), false );
} );
