import apiFetch from '@wordpress/api-fetch';

import {
	applyPromptRefinement,
	fetchReferenceImages,
	fetchPromptRefinements,
	generateImage,
} from '../../src/api';

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

	it( 'omits malformed reference IDs and invalid media IDs', async () => {
		apiFetch.mockResolvedValue( {
			id: '123',
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

	it( 'normalizes rejected and structured API errors', async () => {
		apiFetch.mockRejectedValueOnce( { message: 'Provider unavailable' } );
		await expect( generateImage( 'Failure' ) ).rejects.toThrow(
			'Provider unavailable'
		);

		apiFetch.mockResolvedValueOnce( {
			code: 'generation_failed',
			message: 'Generation failed',
		} );
		await expect( generateImage( 'Failure' ) ).rejects.toThrow(
			'Generation failed'
		);
	} );

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

describe( 'fetchPromptRefinements', () => {
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'posts the whole prompt and returns model-provided refinement choices', async () => {
		apiFetch.mockResolvedValue( {
			terms: [
				{
					text: 'world cup',
					choices: [
						'packed final under floodlights',
						'trophy lift under falling confetti',
					],
				},
				{
					text: 'game',
					choices: [ 'goalkeeper staring down the final penalty' ],
				},
			],
		} );

		const refinements = await fetchPromptRefinements( 'world cup game' );

		expect( apiFetch ).toHaveBeenCalledWith( {
			path: '/kaigen/v1/prompt-refinements',
			method: 'POST',
			data: {
				prompt: 'world cup game',
			},
		} );
		expect( refinements ).toEqual( [
			{
				id: 'world-cup-0',
				text: 'world cup',
				start: 0,
				end: 9,
				choices: [
					'packed final under floodlights',
					'trophy lift under falling confetti',
				],
			},
			{
				id: 'game-10',
				text: 'game',
				start: 10,
				end: 14,
				choices: [ 'goalkeeper staring down the final penalty' ],
			},
		] );
	} );

	it( 'returns no local fallback refinements when the prompt is blank', async () => {
		await expect( fetchPromptRefinements( '   ' ) ).resolves.toEqual( [] );

		expect( apiFetch ).not.toHaveBeenCalled();
	} );
} );

describe( 'applyPromptRefinement', () => {
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'posts the whole prompt and selected detail for model-backed placement', async () => {
		apiFetch.mockResolvedValue( {
			prompt: 'baby goats levitating with iridescent butterfly wings',
		} );

		const prompt = await applyPromptRefinement(
			'baby flying goats',
			{
				text: 'flying',
				start: 5,
				end: 11,
			},
			'levitating with iridescent butterfly wings'
		);

		expect( apiFetch ).toHaveBeenCalledWith( {
			path: '/kaigen/v1/apply-prompt-refinement',
			method: 'POST',
			data: {
				prompt: 'baby flying goats',
				term: 'flying',
				term_start: 5,
				term_end: 11,
				choice: 'levitating with iridescent butterfly wings',
			},
		} );
		expect( prompt ).toBe(
			'baby goats levitating with iridescent butterfly wings'
		);
	} );

	it( 'falls back to local replacement when the apply response is invalid', async () => {
		apiFetch.mockResolvedValue( {} );

		await expect(
			applyPromptRefinement(
				'a duck',
				{
					text: 'duck',
					start: 2,
					end: 6,
				},
				'mallard with emerald head'
			)
		).resolves.toBe( 'a mallard with emerald head' );
	} );
} );
