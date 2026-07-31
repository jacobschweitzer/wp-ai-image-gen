/**
 * Contract test against the real WordPress 7.0 AI Client API.
 */
import { expect, test } from '@playwright/test';

test( '@contract builds an unsupported request through the real AI Client', async ( {
	page,
} ) => {
	const loginResponse = await page.request.post( '/wp-login.php', {
		failOnStatusCode: true,
		form: {
			log: process.env.WP_USERNAME || 'admin',
			pwd: process.env.WP_PASSWORD || 'password',
		},
		maxRedirects: 0,
	} );
	await loginResponse.dispose();
	await page.goto( '/wp-admin/post-new.php', {
		waitUntil: 'domcontentloaded',
	} );
	await page.waitForFunction( () => ( window as any ).wp?.apiFetch, null, {
		timeout: 30000,
	} );

	const contract = await page.evaluate( () =>
		( window as any ).wp.apiFetch( {
			path: '/kaigen-e2e/v1/ai-client-contract',
			method: 'GET',
		} )
	);
	const requestedWordPress = process.env.PLAYGROUND_WP_VERSION || '7.0';
	const requestedPhp = process.env.PLAYGROUND_PHP_VERSION || '8.1';

	expect( contract.phpVersion ).toMatch(
		new RegExp( `^${ requestedPhp.replace( '.', '\\.' ) }` )
	);
	if ( /^\d/.test( requestedWordPress ) ) {
		expect( contract.wordpressVersion ).toMatch(
			new RegExp( `^${ requestedWordPress.replace( '.', '\\.' ) }` )
		);
	} else if ( requestedWordPress === 'nightly' ) {
		expect( contract.wordpressVersion ).toMatch( /alpha|beta|RC/i );
	} else {
		expect( contract.wordpressVersion ).toMatch( /^\d+\.\d+/ );
	}
	expect( contract ).toEqual(
		expect.objectContaining( {
			factoryAvailable: true,
			symbolsAvailable: true,
			requestBuilt: true,
		} )
	);

	const fixtureMedia = await page.evaluate( async () =>
		( window as any ).wp.apiFetch( {
			path: '/kaigen-e2e/v1/reference-media',
			method: 'POST',
		} )
	);
	const reference = fixtureMedia.find( ( item ) => item.marked );

	const result = await page.evaluate( async ( attachmentId ) => {
		try {
			return await ( window as any ).wp.apiFetch( {
				path: '/kaigen/v1/generate-image',
				method: 'POST',
				data: {
					prompt: 'AI Client contract check',
					provider: 'auto',
					orientation: 'landscape',
					source_image_ids: [ attachmentId ],
				},
			} );
		} catch ( error: any ) {
			return {
				code: error?.code,
				message: error?.message,
				status: error?.data?.status,
			};
		}
	}, reference.id );

	expect( result ).toEqual(
		expect.objectContaining( {
			code: 'image_generation_not_supported',
			status: 400,
		} )
	);
} );
