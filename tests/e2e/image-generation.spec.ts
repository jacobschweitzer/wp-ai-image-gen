/**
 * E2E tests for the KaiGen MVP editor surface.
 */
import {
	test,
	expect,
	type FrameLocator,
	type Locator,
	type Page,
} from '@playwright/test';

type BlockRepresentation = {
	name: string;
	attributes?: Record< string, unknown >;
	innerBlocks?: BlockRepresentation[];
};

type EditorHarness = {
	canvas: FrameLocator;
	insertBlock: ( block: BlockRepresentation ) => Promise< void >;
	selectBlocks: ( block: Locator ) => Promise< void >;
};

type GenerationFixtureState = {
	request_count: number;
	last_payload: {
		prompt: string;
		provider: string;
		orientation: string;
		source_image_ids: number[];
	} | null;
	failures_remaining: number;
};

test.describe( 'KaiGen Image Generation', () => {
	const browserErrors = new WeakMap< Page, string[] >();
	const isGenerationBlueprint = () =>
		( process.env.PLAYGROUND_BLUEPRINT || '' ).endsWith(
			'e2e-generation-mocked.json'
		);
	const configureGenerationFixture = async (
		page: Page,
		controls: {
			failure_prompt?: string;
			failures_remaining?: number;
			delay_ms?: number;
		} = {}
	) =>
		page.evaluate(
			async ( fixtureControls ) =>
				( window as any ).wp.apiFetch( {
					path: '/kaigen-e2e/v1/generation-control',
					method: 'POST',
					data: fixtureControls,
				} ),
			controls
		);
	const getGenerationFixtureState = async (
		page: Page
	): Promise< GenerationFixtureState > =>
		page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen-e2e/v1/generation-control',
			} )
		);
	const createEditorHarness = ( page: Page ): EditorHarness => ( {
		canvas: page.frameLocator( '[name="editor-canvas"]' ),
		insertBlock: async ( block ) => {
			await page.waitForFunction(
				() => ( window as any ).wp?.blocks && ( window as any ).wp?.data
			);

			await page.evaluate( ( blockRepresentation ) => {
				const createBlock = ( {
					name,
					attributes = {},
					innerBlocks = [],
				}: BlockRepresentation ) =>
					( window as any ).wp.blocks.createBlock(
						name,
						attributes,
						innerBlocks.map( createBlock )
					);

				( window as any ).wp.data
					.dispatch( 'core/block-editor' )
					.insertBlock( createBlock( blockRepresentation ) );
			}, block );
		},
		selectBlocks: async ( block ) => {
			const clientId = await block.getAttribute( 'data-block' );

			if ( ! clientId ) {
				throw new Error( 'Unable to select block without client ID.' );
			}

			await page.evaluate( ( selectedClientId ) => {
				( window as any ).wp.data
					.dispatch( 'core/block-editor' )
					.selectBlock( selectedClientId );
			}, clientId );
		},
	} );
	const getKaiGenModal = ( page ) => page.locator( '.kaigen-modal' ).last();
	const getKaiGenToolbarButton = ( page ) =>
		page
			.locator( 'button' )
			.filter( { has: page.locator( 'img.kaigen-toolbar-icon' ) } )
			.first();
	const getKaiGenInspectorPanelButton = ( page ) =>
		page
			.getByLabel( 'Editor settings' )
			.getByRole( 'button', { name: 'KaiGen' } );
	const ensureLoggedInAs = async (
		page: Page,
		username: string,
		password: string
	) => {
		await page.context().clearCookies();
		await page.goto( '/wp-login.php', {
			waitUntil: 'domcontentloaded',
		} );
		await page.locator( '#user_login' ).fill( username );
		await page.locator( '#user_pass' ).fill( password );
		await page.locator( '#wp-submit' ).click();
		await page.goto( '/wp-admin/', {
			waitUntil: 'domcontentloaded',
		} );
		if ( page.url().includes( 'wp-login.php' ) ) {
			throw new Error( 'WordPress login failed.' );
		}
	};
	const ensureLoggedIn = async ( page: Page ) =>
		ensureLoggedInAs(
			page,
			process.env.WP_USERNAME || 'admin',
			process.env.WP_PASSWORD || 'password'
		);
	const createNewPost = async ( page: Page ) => {
		await page.goto( '/wp-admin/post-new.php', {
			waitUntil: 'domcontentloaded',
		} );
		await page.waitForFunction( () => ( window as any ).wp?.data );
		await page.evaluate( async () => {
			const preferences = ( window as any ).wp.data.dispatch(
				'core/preferences'
			);

			await preferences.set( 'core/edit-post', 'welcomeGuide', false );
			await preferences.set( 'core/edit-post', 'fullscreenMode', false );
		} );
	};
	const waitForEditorReady = async ( page: Page ) => {
		await page.waitForURL( /post-new\.php|post\.php/ );
		await page.waitForLoadState( 'domcontentloaded' );
		await page.waitForSelector( '.edit-post-layout, .block-editor', {
			timeout: 15000,
			state: 'attached',
		} );
		await page.waitForFunction(
			() =>
				( window as any ).wp?.apiFetch &&
				( window as any ).wp?.data?.select( 'core/block-editor' )
		);
	};
	const waitForKaiGenSettings = async ( page: Page ) => {
		await page.waitForFunction( () => {
			const settings = ( window as any ).wp?.data
				?.select( 'core/editor' )
				?.getEditorSettings()?.kaigen_settings;

			return (
				settings?.is_ai_client_available === true &&
				Array.isArray( settings.providers ) &&
				settings.providers.length >= 3
			);
		} );
	};
	const dismissEditorModals = async ( page ) => {
		for ( let attempts = 0; attempts < 5; attempts++ ) {
			const overlay = page
				.locator( '.components-modal__screen-overlay' )
				.last();
			if (
				! ( await overlay
					.isVisible( { timeout: 500 } )
					.catch( () => false ) )
			) {
				continue;
			}
			const closeButton = overlay.getByRole( 'button', {
				name: /Close|Skip/i,
			} );
			if (
				await closeButton
					.isVisible( { timeout: 1000 } )
					.catch( () => false )
			) {
				await closeButton
					.click( { force: true, timeout: 1000 } )
					.catch( () => {} );
				await overlay
					.waitFor( { state: 'hidden', timeout: 3000 } )
					.catch( () => {} );
				continue;
			}
			await page.keyboard.press( 'Escape' );
		}
	};
	const dismissWelcomeGuide = async ( page: Page ) => {
		const welcomeDialog = page.getByRole( 'dialog', {
			name: 'Welcome to the editor',
		} );

		for ( let attempts = 0; attempts < 5; attempts++ ) {
			if (
				! ( await welcomeDialog
					.isVisible( { timeout: 500 } )
					.catch( () => false ) )
			) {
				continue;
			}

			await welcomeDialog
				.getByRole( 'button', { name: 'Close' } )
				.click( { force: true } );
			await welcomeDialog
				.waitFor( { state: 'hidden', timeout: 3000 } )
				.catch( () => {} );
			return;
		}
	};

	const openImageBlockSettingsTab = async ( page ) => {
		await dismissEditorModals( page );

		const settingsTab = page
			.locator( '.block-editor-block-inspector__tabs button' )
			.filter( { hasText: 'Settings' } )
			.first();
		if (
			await settingsTab
				.isVisible( { timeout: 1000 } )
				.catch( () => false )
		) {
			await settingsTab.click();
			return;
		}

		const iconSettingsTab = page
			.locator(
				'.block-editor-block-inspector__tabs button[aria-label="Settings"]'
			)
			.first();
		if (
			await iconSettingsTab
				.isVisible( { timeout: 1000 } )
				.catch( () => false )
		) {
			await iconSettingsTab.click();
		}
	};

	const openKaiGenModal = async ( page, editor, imageBlock ) => {
		const modal = getKaiGenModal( page );
		const openModal = async () => {
			await dismissWelcomeGuide( page );
			await dismissEditorModals( page );
			const placeholderButton = imageBlock.locator(
				'.kaigen-placeholder-button'
			);
			if (
				await placeholderButton
					.isVisible( { timeout: 1000 } )
					.catch( () => false )
			) {
				await placeholderButton
					.click( { timeout: 5000 } )
					.catch( async () => {
						await dismissWelcomeGuide( page );
						await dismissEditorModals( page );
						await page.keyboard.press( 'Escape' );
						await page
							.locator( '.components-modal__screen-overlay' )
							.waitFor( { state: 'hidden', timeout: 3000 } )
							.catch( () => {} );
						await placeholderButton.click();
					} );
			} else {
				await editor.selectBlocks( imageBlock );
				await getKaiGenToolbarButton( page )
					.click( { timeout: 5000 } )
					.catch( async () => {
						await dismissWelcomeGuide( page );
						await dismissEditorModals( page );
						await page.keyboard.press( 'Escape' );
						await page
							.locator( '.components-modal__screen-overlay' )
							.waitFor( { state: 'hidden', timeout: 3000 } )
							.catch( () => {} );
						await getKaiGenToolbarButton( page ).click();
					} );
			}
		};

		await openModal();
		if (
			! ( await modal
				.isVisible( { timeout: 3000 } )
				.catch( () => false ) )
		) {
			await openModal();
		}
		await expect( modal ).toBeVisible( { timeout: 10000 } );
		await dismissWelcomeGuide( page );
		return modal;
	};

	test.beforeEach( async ( { page } ) => {
		test.setTimeout( 60000 );
		const errors: string[] = [];
		browserErrors.set( page, errors );
		page.on( 'pageerror', ( error ) => {
			errors.push( `pageerror: ${ error.stack || error.message }` );
		} );
		page.on( 'console', ( message ) => {
			if (
				'error' === message.type() &&
				/kaigen|GenerateImageModal|addBlockEditFilter/i.test(
					message.text()
				)
			) {
				errors.push( `console.error: ${ message.text() }` );
			}
		} );
		await ensureLoggedIn( page );
		await createNewPost( page );
		if (
			! page.url().includes( 'post-new.php' ) &&
			! page.url().includes( 'post.php' )
		) {
			await page.goto( '/wp-admin/post-new.php', {
				waitUntil: 'domcontentloaded',
			} );
		}
		await waitForEditorReady( page );
		await waitForKaiGenSettings( page );
		await dismissWelcomeGuide( page );
		await dismissEditorModals( page );
		if ( isGenerationBlueprint() ) {
			await configureGenerationFixture( page );
		}
	} );

	test.afterEach( async ( { page }, testInfo ) => {
		const errors = browserErrors.get( page ) || [];

		if ( errors.length > 0 ) {
			await testInfo.attach( 'browser-errors', {
				body: Buffer.from( errors.join( '\n\n' ) ),
				contentType: 'text/plain',
			} );
		}

		expect( errors ).toEqual( [] );
	} );

	test( '@smoke shows KaiGen on empty image blocks and exposes MVP editor settings', async ( {
		page,
	} ) => {
		const editor = createEditorHarness( page );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );
		await expect(
			imageBlock.locator( '.components-placeholder' )
		).toBeVisible();
		await expect(
			imageBlock.locator( '.kaigen-placeholder-button' )
		).toBeVisible( { timeout: 10000 } );

		const kaiGenSettings = await page.evaluate(
			() =>
				( window as any ).wp.data
					.select( 'core/editor' )
					.getEditorSettings().kaigen_settings
		);
		const legacyKaiGenSettings = await page.evaluate(
			() =>
				( window as any ).wp.data
					.select( 'core/editor' )
					.getEditorSettings().kaigen
		);

		expect( kaiGenSettings ).toEqual(
			expect.objectContaining( {
				provider: 'auto',
				orientation: 'square',
				is_ai_client_available: true,
			} )
		);
		expect( kaiGenSettings.providers ).toEqual( [
			{ id: 'auto', name: 'Auto', referenceImageLimit: 5 },
			{ id: 'e2e-alpha', name: 'E2E Alpha', referenceImageLimit: 5 },
			{ id: 'e2e-beta', name: 'E2E Beta', referenceImageLimit: 5 },
		] );
		expect( legacyKaiGenSettings ).toBeUndefined();
	} );

	test( '@modal modal only shows MVP controls', async ( { page } ) => {
		const editor = createEditorHarness( page );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		const promptInput = modal.getByPlaceholder( 'Type to imagine' );
		await expect( promptInput ).toBeVisible();

		const providerToggle = modal.getByRole( 'button', {
			name: /^Provider:/,
		} );
		await expect( providerToggle ).toBeVisible();
		await providerToggle.click();
		await expect( providerToggle ).toHaveCSS(
			'background-color',
			'rgb(56, 88, 233)'
		);
		await expect(
			page.getByRole( 'menuitemradio', { name: 'Auto' } )
		).toHaveAttribute( 'aria-checked', 'true' );
		await expect(
			page.getByRole( 'menuitemradio', { name: 'E2E Alpha' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitemradio', { name: 'E2E Beta' } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );

		const aspectRatioToggle = modal.getByRole( 'button', {
			name: /^Aspect ratio:/,
		} );
		await aspectRatioToggle.click();
		await expect( aspectRatioToggle ).toHaveCSS(
			'background-color',
			'rgb(56, 88, 233)'
		);
		await expect(
			page.getByRole( 'menuitemradio', { name: /1:1.*Square/i } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitemradio', { name: /16:9.*Wide/i } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitemradio', { name: /9:16.*Vertical/i } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );

		await expect( page.getByText( 'Quality' ) ).toHaveCount( 0 );
		await expect( page.getByText( 'Model' ) ).toHaveCount( 0 );
		await expect( page.getByText( /API key/i ) ).toHaveCount( 0 );
	} );

	test( '@generation inserts a mocked generated image into an empty image block', async ( {
		page,
	} ) => {
		test.skip(
			! isGenerationBlueprint(),
			'Requires the mocked generation blueprint.'
		);

		const editor = createEditorHarness( page );

		await editor.insertBlock( { name: 'core/image' } );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		const promptInput = modal.getByPlaceholder( 'Type to imagine' );
		await promptInput.fill( 'subject' );
		await expect( promptInput ).toHaveValue( 'subject' );
		const generateButton = modal.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await expect( generateButton ).toBeEnabled();

		const generationResponsePromise = page.waitForResponse(
			( response ) =>
				response.url().includes( '/kaigen/v1/generate-image' ) &&
				response.request().method() === 'POST',
			{ timeout: 30000 }
		);
		await generateButton.click( { force: true } );
		const generationResponse = await generationResponsePromise;
		expect( generationResponse.ok() ).toBe( true );
		const generatedMedia = await generationResponse.json();

		const imageAttributes = await page.evaluate( () => {
			const imageBlockInEditor = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getBlocks()
				.find( ( block ) => block.name === 'core/image' );

			return imageBlockInEditor?.attributes;
		} );

		expect( generatedMedia.id ).toBeGreaterThan( 0 );
		expect( generatedMedia.url ).toMatch( /ai-subject(?:-\d+)?\.png/ );
		expect( imageAttributes ).toEqual(
			expect.objectContaining( {
				id: generatedMedia.id,
				url: generatedMedia.url,
				alt: 'subject',
			} )
		);
		await expect( imageBlock.locator( 'img' ).first() ).toHaveAttribute(
			'src',
			generatedMedia.url
		);

		const persistedMedia = await page.evaluate(
			async ( attachmentId ) =>
				( window as any ).wp.apiFetch( {
					path: `/wp/v2/media/${ attachmentId }`,
				} ),
			generatedMedia.id
		);
		expect( persistedMedia ).toEqual(
			expect.objectContaining( {
				id: generatedMedia.id,
				source_url: generatedMedia.url,
				alt_text: 'subject',
			} )
		);
	} );

	test( '@generation retains the prompt after an error and permits a successful retry', async ( {
		page,
	} ) => {
		test.skip(
			! isGenerationBlueprint(),
			'Requires the mocked generation blueprint.'
		);
		await configureGenerationFixture( page, {
			failure_prompt: 'force-error',
			failures_remaining: 1,
		} );

		const editor = createEditorHarness( page );
		await editor.insertBlock( { name: 'core/image' } );
		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		const promptInput = modal.getByPlaceholder( 'Type to imagine' );
		const generateButton = modal.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await promptInput.fill( 'force-error' );

		const failedResponse = page.waitForResponse(
			( response ) =>
				response.url().includes( '/kaigen/v1/generate-image' ) &&
				response.request().method() === 'POST'
		);
		await generateButton.click();
		expect( ( await failedResponse ).status() ).toBe( 500 );

		await expect(
			modal.getByText( 'E2E mocked generation failure.' )
		).toBeVisible();
		await expect( modal ).toBeVisible();
		await expect( promptInput ).toHaveValue( 'force-error' );
		await expect( generateButton ).toBeEnabled();

		const retryResponse = page.waitForResponse(
			( response ) =>
				response.url().includes( '/kaigen/v1/generate-image' ) &&
				response.request().method() === 'POST'
		);
		await generateButton.click();
		const successfulRetry = await retryResponse;
		expect( successfulRetry.ok() ).toBe( true );
		const generatedMedia = await successfulRetry.json();
		await expect( imageBlock.locator( 'img' ).first() ).toHaveAttribute(
			'src',
			generatedMedia.url
		);

		const fixtureState = await getGenerationFixtureState( page );
		expect( fixtureState.request_count ).toBe( 2 );
		expect( fixtureState.failures_remaining ).toBe( 0 );
	} );

	test( '@generation sends the selected generation payload contract', async ( {
		page,
	} ) => {
		test.skip(
			! isGenerationBlueprint(),
			'Requires the mocked generation blueprint.'
		);

		const fixtureMedia = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen-e2e/v1/reference-media',
				method: 'POST',
			} )
		);
		const markedFixture = fixtureMedia.find( ( item ) => item.marked );

		const editor = createEditorHarness( page );
		await editor.insertBlock( { name: 'core/image' } );
		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		await modal.getByRole( 'button', { name: 'Reference Images' } ).click();
		await page
			.getByRole( 'menuitemcheckbox', {
				name: 'KaiGen marked reference fixture',
			} )
			.click();

		await modal.getByRole( 'button', { name: /^Provider:/ } ).click();
		await page.getByRole( 'menuitemradio', { name: 'E2E Beta' } ).click();
		await modal.getByRole( 'button', { name: /^Aspect ratio:/ } ).click();
		await page
			.getByRole( 'menuitemradio', { name: /9:16.*Vertical/i } )
			.click();

		await modal
			.getByPlaceholder( 'Type to imagine' )
			.fill( 'contract subject' );
		const generationResponse = page.waitForResponse(
			( response ) =>
				response.url().includes( '/kaigen/v1/generate-image' ) &&
				response.request().method() === 'POST'
		);
		await modal.getByRole( 'button', { name: 'Generate Image' } ).click();
		expect( ( await generationResponse ).ok() ).toBe( true );

		const fixtureState = await getGenerationFixtureState( page );
		expect( fixtureState.request_count ).toBe( 1 );
		expect( fixtureState.last_payload ).toEqual( {
			prompt: 'contract subject',
			provider: 'e2e-beta',
			orientation: 'portrait',
			source_image_ids: [ markedFixture.id ],
		} );
	} );

	test( '@generation sends one request while generation is pending', async ( {
		page,
	} ) => {
		test.skip(
			! isGenerationBlueprint(),
			'Requires the mocked generation blueprint.'
		);
		await configureGenerationFixture( page, { delay_ms: 1000 } );

		const editor = createEditorHarness( page );
		await editor.insertBlock( { name: 'core/image' } );
		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		const promptInput = modal.getByPlaceholder( 'Type to imagine' );
		const generateButton = modal.getByRole( 'button', {
			name: 'Generate Image',
		} );
		await promptInput.fill( 'single flight subject' );

		const generationResponse = page.waitForResponse(
			( response ) =>
				response.url().includes( '/kaigen/v1/generate-image' ) &&
				response.request().method() === 'POST'
		);
		await generateButton.click();
		await expect( generateButton ).toBeDisabled();
		await promptInput.press( 'Enter' );
		await generateButton.click( { force: true } );
		expect( ( await generationResponse ).ok() ).toBe( true );

		const fixtureState = await getGenerationFixtureState( page );
		expect( fixtureState.request_count ).toBe( 1 );
	} );

	test( '@generation keeps keyboard generation and progress state reachable on a narrow viewport', async ( {
		page,
	} ) => {
		test.skip(
			! isGenerationBlueprint(),
			'Requires the mocked generation blueprint.'
		);
		await page.setViewportSize( { width: 390, height: 844 } );
		await configureGenerationFixture( page, { delay_ms: 1000 } );

		const editor = createEditorHarness( page );
		await editor.insertBlock( { name: 'core/image' } );
		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );

		const modal = await openKaiGenModal( page, editor, imageBlock );
		const promptInput = modal.getByPlaceholder( 'Type to imagine' );
		await expect(
			modal.getByRole( 'button', { name: 'Reference Images' } )
		).toBeVisible();
		await expect(
			modal.getByRole( 'button', { name: /^Aspect ratio:/ } )
		).toBeVisible();
		await expect(
			modal.getByRole( 'button', { name: 'Generate Image' } )
		).toBeVisible();

		await promptInput.fill( 'A keyboard-generated mobile image' );
		const generationResponse = page.waitForResponse(
			( response ) =>
				response.url().includes( '/kaigen/v1/generate-image' ) &&
				response.request().method() === 'POST'
		);
		await promptInput.press( 'Enter' );

		const progress = modal.getByRole( 'progressbar', {
			name: 'Image generation progress',
		} );
		await expect( progress ).toBeVisible();
		await expect( progress ).toHaveAttribute( 'aria-valuemin', '0' );
		await expect( progress ).toHaveAttribute( 'aria-valuemax', '100' );
		expect( ( await generationResponse ).ok() ).toBe( true );
		await expect( imageBlock.locator( 'img' ).first() ).toBeVisible();
	} );

	test( '@generation denies image generation to a user who cannot upload media', async ( {
		page,
	} ) => {
		test.skip(
			! isGenerationBlueprint(),
			'Requires the mocked generation blueprint.'
		);
		const username = `kaigen-viewer-${ Date.now() }`;
		const password = 'KaiGen-E2E-viewer-59!';

		await page.evaluate(
			async ( user ) =>
				( window as any ).wp.apiFetch( {
					path: '/wp/v2/users',
					method: 'POST',
					data: {
						username: user.username,
						email: `${ user.username }@example.com`,
						password: user.password,
						roles: [ 'subscriber' ],
					},
				} ),
			{ username, password }
		);

		await ensureLoggedInAs( page, username, password );
		await page.waitForFunction( () => ( window as any ).wp?.apiFetch );
		const currentUser = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/wp/v2/users/me?context=edit',
			} )
		);
		expect( currentUser.roles ).toEqual( [ 'subscriber' ] );
		expect( currentUser.capabilities.upload_files ).not.toBe( true );
		const denial = await page.evaluate( async () => {
			try {
				await ( window as any ).wp.apiFetch( {
					path: '/kaigen/v1/generate-image',
					method: 'POST',
					data: { prompt: 'A forbidden generation request' },
				} );
				return { code: 'unexpected_success', status: 200 };
			} catch ( error ) {
				return {
					code: error.code,
					status: error.data?.status,
				};
			}
		} );

		expect( denial ).toEqual( {
			code: 'rest_forbidden',
			status: 403,
		} );

		await ensureLoggedIn( page );
		await page.waitForFunction( () => ( window as any ).wp?.apiFetch );
		const fixtureState = await getGenerationFixtureState( page );
		expect( fixtureState.request_count ).toBe( 0 );
	} );

	test( '@reference persists reference image marking in the image block sidebar', async ( {
		page,
	} ) => {
		const editor = createEditorHarness( page );

		await waitForEditorReady( page );
		const fixtureMedia = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen-e2e/v1/reference-media',
				method: 'POST',
			} )
		);
		expect( fixtureMedia ).toEqual(
			expect.arrayContaining( [
				expect.objectContaining( { marked: true } ),
				expect.objectContaining( { marked: false } ),
			] )
		);

		const markedFixture = fixtureMedia.find( ( item ) => item.marked );
		expect( markedFixture.id ).toBeGreaterThan( 0 );
		expect( markedFixture.url ).toContain( 'kaigen-reference-marked' );
		const unmarkedFixture = fixtureMedia.find( ( item ) => ! item.marked );
		expect( unmarkedFixture.id ).toBeGreaterThan( 0 );
		expect( unmarkedFixture.url ).toContain( 'kaigen-reference-unmarked' );

		await editor.insertBlock( {
			name: 'core/image',
			attributes: {
				id: unmarkedFixture.id,
				url: unmarkedFixture.url,
			},
		} );

		const imageBlock = editor.canvas.locator( '[data-type="core/image"]' );
		await expect( imageBlock ).toBeVisible( { timeout: 10000 } );
		await editor.selectBlocks( imageBlock );
		await openImageBlockSettingsTab( page );

		const kaiGenPanelButton = getKaiGenInspectorPanelButton( page );
		await expect( kaiGenPanelButton ).toBeVisible( { timeout: 10000 } );
		if (
			( await kaiGenPanelButton.getAttribute( 'aria-expanded' ) ) !==
			'true'
		) {
			await kaiGenPanelButton.click();
		}

		const referenceImageCheckbox = page.getByRole( 'checkbox', {
			name: 'Reference image',
		} );
		await expect( referenceImageCheckbox ).toBeVisible( {
			timeout: 10000,
		} );
		await expect( referenceImageCheckbox ).not.toBeChecked();

		const attachmentId = await page.evaluate( () => {
			const selectedBlock = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getSelectedBlock();
			return Number( selectedBlock?.attributes?.id );
		} );

		const markResponsePromise = page.waitForResponse(
			( response ) =>
				response
					.url()
					.includes( `/wp-json/wp/v2/media/${ attachmentId }` ) &&
				response.request().method() === 'POST'
		);
		await referenceImageCheckbox.check();
		expect( ( await markResponsePromise ).ok() ).toBe( true );

		await expect
			.poll(
				async () =>
					page.evaluate( async ( id ) => {
						const response = await ( window as any ).wp.apiFetch( {
							path: `/wp/v2/media/${ id }`,
						} );
						return response?.meta?.kaigen_reference_image;
					}, attachmentId ),
				{ timeout: 10000 }
			)
			.toBe( true );

		const referenceImages = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen/v1/reference-images',
			} )
		);

		expect(
			referenceImages.some( ( image ) => image.id === attachmentId )
		).toBe( true );
		await expect( referenceImageCheckbox ).toBeChecked();

		const unmarkResponsePromise = page.waitForResponse(
			( response ) =>
				response
					.url()
					.includes( `/wp-json/wp/v2/media/${ attachmentId }` ) &&
				response.request().method() === 'POST'
		);
		await referenceImageCheckbox.uncheck();
		expect( ( await unmarkResponsePromise ).ok() ).toBe( true );
		await expect( referenceImageCheckbox ).not.toBeChecked();

		await expect
			.poll(
				async () =>
					page.evaluate( async ( id ) => {
						const response = await ( window as any ).wp.apiFetch( {
							path: `/wp/v2/media/${ id }`,
						} );
						return response?.meta?.kaigen_reference_image;
					}, attachmentId ),
				{ timeout: 10000 }
			)
			.toBe( false );

		const updatedReferenceImages = await page.evaluate( async () =>
			( window as any ).wp.apiFetch( {
				path: '/kaigen/v1/reference-images',
			} )
		);

		expect(
			updatedReferenceImages.some(
				( image ) => image.id === attachmentId
			)
		).toBe( false );
	} );
} );
