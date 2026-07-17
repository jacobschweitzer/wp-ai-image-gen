import apiFetch from '@wordpress/api-fetch';

export const generateImage = async ( prompt, options = {} ) => {
	const data = {
		prompt,
		provider: options.provider || 'auto',
		orientation: options.orientation || 'square',
	};

	try {
		return await apiFetch( {
			path: '/kaigen/v1/generate-image',
			method: 'POST',
			data,
		} );
	} catch ( error ) {
		const generationError = new Error(
			error.message ||
				'An unknown error occurred while generating the image'
		);
		generationError.code = error.code;
		generationError.status = error.status || error.data?.status;
		generationError.data = error.data;
		throw generationError;
	}
};
