import { generateAndInsertAssets } from '../../src/image-agent/packageRunner';

const createAsset = ( id = 'asset-1' ) => ( {
	id,
	prompt: `Prompt for ${ id }`,
	orientation: 'landscape',
	insertIntoPost: true,
} );

const createRateLimitError = () => {
	const error = new Error( 'Too Many Requests' );
	error.code = 'rest_rate_limited';
	error.data = { status: 429 };
	return error;
};

describe( 'generateAndInsertAssets', () => {
	it( 'inserts each image before generating the next package image', async () => {
		const events = [];
		const assets = [ createAsset( 'asset-1' ), createAsset( 'asset-2' ) ];
		const generateImage = jest.fn( async ( prompt ) => {
			events.push( `generate:${ prompt }` );
			return {
				id: events.length,
				url: `https://example.com/${ events.length }.jpg`,
			};
		} );
		const insertGeneratedAsset = jest.fn( ( asset ) => {
			events.push( `insert:${ asset.prompt }` );
			return {
				inserted: true,
				selected: true,
			};
		} );

		await generateAndInsertAssets(
			assets,
			{ provider: 'auto' },
			{
				generateImage,
				insertGeneratedAsset,
				retryDelays: [],
			}
		);

		expect( events ).toEqual( [
			'generate:Prompt for asset-1',
			'insert:Prompt for asset-1',
			'generate:Prompt for asset-2',
			'insert:Prompt for asset-2',
		] );
	} );

	it( 'retries a rate-limited image before inserting the generated result', async () => {
		const asset = createAsset();
		const generateImage = jest
			.fn()
			.mockRejectedValueOnce( createRateLimitError() )
			.mockResolvedValueOnce( {
				id: 123,
				url: 'https://example.com/generated.jpg',
			} );
		const insertGeneratedAsset = jest.fn( () => ( {
			inserted: true,
			selected: true,
		} ) );
		const wait = jest.fn( () => Promise.resolve() );
		const onProgress = jest.fn();
		const onStatus = jest.fn();

		const result = await generateAndInsertAssets(
			[ asset ],
			{ provider: 'auto' },
			{
				generateImage,
				insertGeneratedAsset,
				wait,
				retryDelays: [ 10 ],
				onProgress,
				onStatus,
			}
		);

		expect( generateImage ).toHaveBeenCalledTimes( 2 );
		expect( wait ).toHaveBeenCalledWith( 10 );
		expect( onStatus ).toHaveBeenCalledWith(
			expect.stringContaining( 'Rate limited. Retrying' )
		);
		expect( insertGeneratedAsset ).toHaveBeenCalledWith(
			expect.objectContaining( {
				...asset,
				status: 'completed',
				media: expect.objectContaining( {
					url: 'https://example.com/generated.jpg',
				} ),
			} )
		);
		expect( onProgress ).toHaveBeenCalledWith( 1, 1 );
		expect( result ).toMatchObject( {
			insertedCount: 1,
			selectedCount: 1,
			failedCount: 0,
			rateLimited: false,
		} );
	} );

	it( 'tries another configured provider for the same image before waiting', async () => {
		const asset = createAsset();
		const generateImage = jest.fn( ( prompt, options ) => {
			if ( options.provider === 'openai' ) {
				return Promise.reject( createRateLimitError() );
			}

			return Promise.resolve( {
				id: 124,
				url: 'https://example.com/google-generated.jpg',
			} );
		} );
		const insertGeneratedAsset = jest.fn( () => ( {
			inserted: true,
			selected: true,
		} ) );
		const wait = jest.fn( () => Promise.resolve() );

		const result = await generateAndInsertAssets(
			[ asset ],
			{
				provider: 'auto',
				providers: [
					{ id: 'auto', name: 'Auto' },
					{ id: 'openai', name: 'OpenAI' },
					{ id: 'google', name: 'Google' },
				],
			},
			{
				generateImage,
				insertGeneratedAsset,
				wait,
				retryDelays: [ 10 ],
			}
		);

		expect( generateImage ).toHaveBeenNthCalledWith(
			1,
			asset.prompt,
			expect.objectContaining( {
				provider: 'openai',
			} )
		);
		expect( generateImage ).toHaveBeenNthCalledWith(
			2,
			asset.prompt,
			expect.objectContaining( {
				provider: 'google',
			} )
		);
		expect( wait ).not.toHaveBeenCalled();
		expect( insertGeneratedAsset ).toHaveBeenCalledTimes( 1 );
		expect( result ).toMatchObject( {
			selectedCount: 1,
			rateLimited: false,
		} );
	} );

	it( 'stops the package after the rate-limit retry budget is exhausted', async () => {
		const assets = [ createAsset( 'asset-1' ), createAsset( 'asset-2' ) ];
		const generateImage = jest.fn( () =>
			Promise.reject( createRateLimitError() )
		);
		const insertGeneratedAsset = jest.fn();
		const wait = jest.fn( () => Promise.resolve() );
		const onProgress = jest.fn();

		const result = await generateAndInsertAssets(
			assets,
			{ provider: 'auto' },
			{
				generateImage,
				insertGeneratedAsset,
				wait,
				retryDelays: [ 10, 20 ],
				onProgress,
			}
		);

		expect( generateImage ).toHaveBeenCalledTimes( 3 );
		expect( wait ).toHaveBeenCalledTimes( 2 );
		expect( insertGeneratedAsset ).not.toHaveBeenCalled();
		expect( onProgress ).toHaveBeenCalledWith( 1, 2 );
		expect( result ).toMatchObject( {
			insertedCount: 0,
			selectedCount: 0,
			failedCount: 1,
			rateLimited: true,
		} );
	} );
} );
