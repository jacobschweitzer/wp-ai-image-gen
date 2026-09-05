/**
 * Real WordPress REST acceptance tests for the base plugin.
 */
import { expect, test } from '@playwright/test';

test( 'anonymous users cannot access KaiGen REST endpoints', async ( {
	request,
} ) => {
	await expect
		.poll( async () => {
			const response = await request.get(
				'/wp-json/kaigen/v1/providers'
			);
			return response.status();
		} )
		.toBe( 401 );

	const response = await request.get( '/wp-json/kaigen/v1/providers' );
	const body = await response.json();

	expect( response.status() ).toBe( 401 );
	expect( body ).toEqual(
		expect.objectContaining( {
			code: 'rest_forbidden',
		} )
	);
} );
