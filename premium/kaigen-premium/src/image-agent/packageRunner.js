import { generateImage as defaultGenerateImage } from '../api';

export const RATE_LIMIT_RETRY_DELAYS_MS = [ 15000, 45000 ];

const defaultWait = ( delayMs ) =>
	new Promise( ( resolve ) => {
		window.setTimeout( resolve, delayMs );
	} );

export const isRateLimitError = ( error ) =>
	/too many requests|rate[\s_-]?limit|throttl|429/i.test(
		[ error?.message, error?.code, error?.status, error?.data?.status ]
			.filter( Boolean )
			.join( ' ' )
	);

const formatDelay = ( delayMs ) => {
	const seconds = Math.max( 1, Math.round( delayMs / 1000 ) );
	return `${ seconds }s`;
};

const getGeneratedAssets = ( assets ) =>
	assets.filter(
		( asset ) =>
			asset.selected !== false &&
			asset.status === 'completed' &&
			asset.media?.url
	);

const getProviderAttempts = ( kaiGenSettings ) => {
	const configuredProviderIds = ( kaiGenSettings.providers || [] )
		.map( ( provider ) => provider.id )
		.filter( ( providerId ) => providerId && providerId !== 'auto' );
	const selectedProvider = kaiGenSettings.provider || 'auto';
	const providerIds =
		selectedProvider === 'auto'
			? configuredProviderIds
			: [
					selectedProvider,
					...configuredProviderIds.filter(
						( providerId ) => providerId !== selectedProvider
					),
			  ];
	const uniqueProviderIds = [ ...new Set( providerIds ) ];

	return uniqueProviderIds.length ? uniqueProviderIds : [ 'auto' ];
};

const generateImageWithRetries = async (
	asset,
	kaiGenSettings,
	{
		generateImage = defaultGenerateImage,
		wait = defaultWait,
		retryDelays = RATE_LIMIT_RETRY_DELAYS_MS,
		onStatus = () => {},
	} = {}
) => {
	const providerAttempts = getProviderAttempts( kaiGenSettings );

	for (
		let attemptIndex = 0;
		attemptIndex <= retryDelays.length;
		attemptIndex++
	) {
		let lastRateLimitError = null;

		for ( const provider of providerAttempts ) {
			try {
				onStatus( '' );
				return {
					media: await generateImage( asset.prompt, {
						provider,
						orientation: asset.orientation,
					} ),
					error: null,
					rateLimited: false,
				};
			} catch ( error ) {
				if ( ! isRateLimitError( error ) ) {
					return {
						media: null,
						error,
						rateLimited: false,
					};
				}

				lastRateLimitError = error;
			}
		}

		if ( attemptIndex >= retryDelays.length ) {
			return {
				media: null,
				error: lastRateLimitError,
				rateLimited: true,
			};
		}

		const delayMs = retryDelays[ attemptIndex ];
		onStatus( `Rate limited. Retrying in ${ formatDelay( delayMs ) }...` );
		await wait( delayMs );
	}

	return {
		media: null,
		error: new Error( 'Unable to generate this asset.' ),
		rateLimited: false,
	};
};

export const generateAndInsertAssets = async (
	assets,
	kaiGenSettings,
	{
		generateImage = defaultGenerateImage,
		insertGeneratedAsset,
		wait = defaultWait,
		retryDelays = RATE_LIMIT_RETRY_DELAYS_MS,
		onProgress = () => {},
		onStatus = () => {},
	} = {}
) => {
	const generatedAssets = [];
	let insertedCount = 0;
	let selectedCount = 0;
	let completedCount = 0;
	let failedCount = 0;
	let rateLimited = false;

	for ( const asset of assets ) {
		const result = await generateImageWithRetries( asset, kaiGenSettings, {
			generateImage,
			wait,
			retryDelays,
			onStatus,
		} );

		if ( result.media ) {
			const generatedAsset = {
				...asset,
				status: 'completed',
				media: result.media,
			};
			const insertionResult = insertGeneratedAsset( generatedAsset );

			generatedAssets.push( generatedAsset );
			insertedCount += insertionResult.inserted ? 1 : 0;
			selectedCount += insertionResult.selected ? 1 : 0;
		} else {
			generatedAssets.push( {
				...asset,
				status: 'failed',
				error:
					result.error?.message || 'Unable to generate this asset.',
			} );
			failedCount += 1;
			rateLimited = result.rateLimited;
		}

		completedCount += 1;
		onProgress( completedCount, assets.length );
		onStatus( '' );

		if ( rateLimited ) {
			break;
		}
	}

	return {
		generatedAssets: getGeneratedAssets( generatedAssets ),
		insertedCount,
		selectedCount,
		failedCount,
		rateLimited,
	};
};
