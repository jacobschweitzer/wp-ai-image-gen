import apiFetch from '@wordpress/api-fetch';

import { fetchReferenceImages, generateImage } from '../../src/api';

jest.mock( '@wordpress/api-fetch' );

describe( 'generateImage', () => {
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'posts the generation payload and returns normalized media', async () => {
		apiFetch.mockResolvedValue( {
			id: 123,
			url: 'https://example.com/generated-image.jpg',
			metadata: {
				provider: 'openai',
			},
		} );

		const media = await generateImage( 'A robot painting a mural', {
			provider: 'openai',
			orientation: 'landscape',
			sourceImageIds: [ 10, 11 ],
		} );

		expect( apiFetch ).toHaveBeenCalledWith( {
			path: '/kaigen/v1/generate-image',
			method: 'POST',
			data: {
				prompt: 'A robot painting a mural',
				provider: 'openai',
				orientation: 'landscape',
				source_image_ids: [ 10, 11 ],
			},
		} );
		expect( media ).toEqual( {
			id: 123,
			url: 'https://example.com/generated-image.jpg',
			alt: 'A robot painting a mural',
			caption: '',
			metadata: {
				provider: 'openai',
			},
		} );
	} );

	it( 'does not post URL-only reference images', async () => {
		apiFetch.mockResolvedValue( {
			id: 124,
			url: 'https://example.com/generated-image.jpg',
		} );

		await generateImage( 'A robot painting a mural', {
			sourceImageIds: [ 10 ],
			sourceImageUrls: [ 'https://example.com/reference.jpg' ],
		} );

		expect( apiFetch ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.not.objectContaining( {
					source_image_urls: expect.any( Array ),
				} ),
			} )
		);
		expect( apiFetch ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.objectContaining( {
					source_image_ids: [ 10 ],
				} ),
			} )
		);
	} );

	it( 'uses safe defaults and omits absent reference IDs', async () => {
		apiFetch.mockResolvedValue( {
			url: 'https://example.com/generated-image.jpg',
		} );

		const media = await generateImage( 'Default request' );

		expect( apiFetch ).toHaveBeenCalledWith( {
			path: '/kaigen/v1/generate-image',
			method: 'POST',
			data: {
				prompt: 'Default request',
				provider: 'auto',
				orientation: 'square',
			},
		} );
		expect( media ).not.toHaveProperty( 'id' );
	} );

	it.each( [ '123', -1, 0 ] )( 'omits invalid media ID %p', async ( id ) => {
		apiFetch.mockResolvedValue( {
			id,
			url: 'https://example.com/generated-image.jpg',
		} );

		const media = await generateImage( 'Invalid identifiers', {
			sourceImageIds: '10',
		} );

		expect( apiFetch ).toHaveBeenCalledWith(
			expect.objectContaining( {
				data: expect.not.objectContaining( {
					source_image_ids: expect.anything(),
				} ),
			} )
		);
		expect( media ).not.toHaveProperty( 'id' );
	} );

	it( 'preserves a rejected API error message', async () => {
		apiFetch.mockRejectedValueOnce( { message: 'Provider unavailable' } );
		await expect( generateImage( 'Failure' ) ).rejects.toThrow(
			'Provider unavailable'
		);
	} );

	it( 'preserves a structured API error message exactly', async () => {
		apiFetch.mockResolvedValueOnce( {
			code: 'generation_failed',
			message: 'Generation failed',
		} );
		await expect( generateImage( 'Failure' ) ).rejects.toEqual(
			new Error( 'Generation failed' )
		);
	} );

	it( 'provides a fallback when a rejected API error has no message', async () => {
		apiFetch.mockRejectedValue( {} );
		await expect( generateImage( 'Failure' ) ).rejects.toEqual(
			new Error( 'An unknown error occurred while generating the image' )
		);
	} );

	it.each( [ { code: 'metadata' }, { message: 'metadata' } ] )(
		'accepts media with incomplete error metadata %p',
		async ( metadata ) => {
			const url = 'https://example.com/generated-image.jpg';
			apiFetch.mockResolvedValue( { ...metadata, url } );
			await expect( generateImage( 'A lighthouse' ) ).resolves.toEqual( {
				url,
				alt: 'A lighthouse',
				caption: '',
				metadata: null,
			} );
		}
	);

	it( 'throws when the server response does not include an image URL', async () => {
		apiFetch.mockResolvedValue( {
			id: 123,
		} );

		await expect( generateImage( 'A missing image URL' ) ).rejects.toThrow(
			'Invalid response from server: {"id":123}'
		);
	} );
} );

describe( 'fetchReferenceImages', () => {
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'returns only valid collections and absorbs request failures', async () => {
		const references = [ { id: 10, url: 'https://example.com/ref.png' } ];
		apiFetch.mockResolvedValueOnce( references );

		await expect( fetchReferenceImages() ).resolves.toEqual( references );
		expect( apiFetch ).toHaveBeenCalledWith( {
			path: '/kaigen/v1/reference-images',
			method: 'GET',
		} );

		apiFetch.mockResolvedValueOnce( { references } );
		await expect( fetchReferenceImages() ).resolves.toEqual( [] );

		apiFetch.mockRejectedValueOnce( new Error( 'Network failure' ) );
		await expect( fetchReferenceImages() ).resolves.toEqual( [] );
	} );
} );
