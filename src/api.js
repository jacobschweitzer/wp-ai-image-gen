// This file provides API functions for fetching available providers and generating AI images.

/**
 * Fetches available providers from the server.
 *
 * @returns {Promise<Object>} A promise that resolves to an object containing provider IDs and names.
 */
export const fetchProviders = async () => { // This function fetches providers using WordPress API.
    try {
        // Attempt to fetch providers using wp.apiFetch.
        const response = await wp.apiFetch({ path: '/wp-ai-image-gen/v1/providers' });
        return response; // Return the successful response.
    } catch (error) {
        // Log any errors that occur during fetch.
        console.error('Error fetching providers:', error);
        // Return an object with an error field to indicate failure.
        return { error: 'Unable to fetch providers. Please try again later.' };
    }
};

/**
 * Generates an AI image based on the given prompt and provider.
 *
 * @param {string} prompt - The text prompt for image generation.
 * @param {string} provider - The selected provider ID.
 * @param {function} callback - The callback function to handle the generated image data.
 * @returns {Promise<void>} A promise that resolves when the image generation is complete.
 */
export const generateImage = async ( prompt, provider, callback ) => { // This function handles image generation using the WordPress API.
    try {
        // Call the WordPress API to generate the image.
        const response = await wp.apiFetch({
            path: '/wp-ai-image-gen/v1/generate-image',
            method: 'POST',
            data: { prompt, provider },
        });

        // If the response contains a valid URL, return the image data.
        if (response && response.url) {
            callback({
                url: response.url,
                alt: prompt,
                id: response.id || `ai-generated-${Date.now()}`, // Use a fallback ID if none is provided.
                caption: '',
            });
        } else {
            // If the response indicates NSFW content, throw an error.
            if (response && response.error && response.error.includes('NSFW content')) {
                throw new Error('The image could not be generated due to potential inappropriate content. Please try a different prompt.');
            } else {
                // Throw an error for any other invalid response.
                throw new Error('Invalid response from server: ' + JSON.stringify(response));
            }
        }
    } catch (error) {
        // Log detailed error information.
        console.error('Detailed error in generateImage:', error);
        if (error.message) console.error('Error message:', error.message);
        if (error.stack) console.error('Error stack:', error.stack);
        // Call the callback with the error information.
        callback({ error: error.message || 'Unknown error occurred' });
    }
}; 