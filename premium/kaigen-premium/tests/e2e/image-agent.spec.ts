import { test, expect, type Page } from '@playwright/test';

const prepareEditor = async ( page: Page ) => {
	await page.request.post( '/wp-login.php', {
		form: {
			log: process.env.WP_USERNAME || 'admin',
			pwd: process.env.WP_PASSWORD || 'password',
		},
	} );
	await page.goto( '/wp-admin/post-new.php', {
		waitUntil: 'domcontentloaded',
	} );
	await page.waitForFunction(
		() =>
			( window as any ).wp?.apiFetch &&
			( window as any ).wp?.data?.select( 'core/block-editor' )
	);

	const welcomeDialog = page.getByRole( 'dialog', {
		name: 'Welcome to the editor',
	} );
	if ( await welcomeDialog.isVisible().catch( () => false ) ) {
		await welcomeDialog.getByRole( 'button', { name: 'Close' } ).click();
	}
};

test.describe( 'KaiGen Premium Image Agent', () => {
	test.beforeEach( async ( { page } ) => {
		test.setTimeout( 60000 );
		await prepareEditor( page );
	} );

	test( '@generation Image Agent generates and inserts an article package', async ( {
		page,
	} ) => {
		test.setTimeout( 120000 );
		test.skip(
			! /e2e-(?:premium-)?generation(?:-mocked)?\.json$/.test(
				process.env.PLAYGROUND_BLUEPRINT || ''
			),
			'Requires the mocked generation blueprint.'
		);

		await page.evaluate( () => {
			const paragraph = ( content: string ) =>
				( window as any ).wp.blocks.createBlock( 'core/paragraph', {
					content,
				} );

			( window as any ).wp.data.dispatch( 'core/editor' ).editPost( {
				title: 'Contextual image workflows for publishers',
			} );
			( window as any ).wp.data
				.dispatch( 'core/block-editor' )
				.insertBlocks( [
					paragraph(
						'A rescued monkey adapts to a city wildlife sanctuary after losing its rainforest habitat. Editors need a concrete visual of the monkey, the canopy, and the sanctuary setting so this paragraph does not get a generic technology image.'
					),
					paragraph(
						'The campaign numbers improved from 12% reader conversion to 38% reader conversion after the publisher added contextual article images. This paragraph should produce a numbers-led graphic instead of an unrelated illustration.'
					),
					paragraph(
						'The editorial workflow starts with draft review, continues through image planning, moves into social crop creation, and ends with a final approval pass. The process needs a workflow-style visual placed beside this explanation.'
					),
					paragraph(
						'The conclusion compares manual image production with an automated publishing assistant, explaining the tradeoffs in speed, consistency, and revenue impact for a lean newsroom.'
					),
				] );
		} );

		const imageAgentButton = page.getByRole( 'button', {
			name: 'Image Agent',
		} );
		await expect( imageAgentButton ).toBeVisible( { timeout: 10000 } );
		await page.route( '**/kaigen/v1/generate-image**', async ( route ) => {
			await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );
			await route.continue();
		} );

		const generationResponses = Promise.all(
			Array.from( { length: 5 }, () =>
				page.waitForResponse(
					( response ) =>
						response
							.url()
							.includes( '/kaigen/v1/generate-image' ) &&
						response.request().method() === 'POST',
					{ timeout: 45000 }
				)
			)
		);
		await imageAgentButton.click();
		await expect( page.locator( '.kaigen-image-agent-modal' ) ).toHaveCount(
			0
		);
		await expect(
			page.getByRole( 'button', {
				name: 'Generating 0/5 images...',
			} )
		).toBeVisible( { timeout: 5000 } );
		await expect(
			page.getByRole( 'button', {
				name: /Generating [1-4]\/5 images\.\.\./,
			} )
		).toBeVisible( { timeout: 10000 } );
		expect(
			( await generationResponses ).every( ( response ) => response.ok() )
		).toBe( true );
		await expect(
			page.getByRole( 'button', { name: 'Done' } )
		).toBeVisible( { timeout: 5000 } );

		await expect
			.poll(
				async () =>
					page.evaluate( () =>
						( window as any ).wp.data
							.select( 'core/editor' )
							.getEditedPostAttribute( 'featured_media' )
					),
				{ timeout: 10000 }
			)
			.toBeGreaterThan( 0 );

		await expect
			.poll(
				async () =>
					page.evaluate(
						() =>
							( window as any ).wp.data
								.select( 'core/block-editor' )
								.getBlocks()
								.filter(
									( block ) => block.name === 'core/image'
								).length
					),
				{ timeout: 10000 }
			)
			.toBe( 4 );

		const contextualPlacement = await page.evaluate( () => {
			const blocks = ( window as any ).wp.data
				.select( 'core/block-editor' )
				.getBlocks();
			const hasImageImmediatelyBeforeParagraph = ( phrase: string ) =>
				blocks.some(
					( block, index ) =>
						block.name === 'core/image' &&
						blocks[ index + 1 ]?.name === 'core/paragraph' &&
						blocks[ index + 1 ]?.attributes?.content?.includes(
							phrase
						)
				);

			return {
				lastBlockName: blocks[ blocks.length - 1 ]?.name,
				hasMonkeyImage: hasImageImmediatelyBeforeParagraph(
					'A rescued monkey adapts'
				),
				hasNumbersImage: hasImageImmediatelyBeforeParagraph(
					'12% reader conversion'
				),
			};
		} );

		expect( contextualPlacement.lastBlockName ).toBe( 'core/paragraph' );
		expect( contextualPlacement.hasMonkeyImage ).toBe( true );
		expect( contextualPlacement.hasNumbersImage ).toBe( true );
	} );
} );
