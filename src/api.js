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
export const generateImage = async (prompt, provider, callback) => {
    try {
        const response = await wp.apiFetch({
            path: '/wp-ai-image-gen/v1/generate-image',
            method: 'POST',
            data: { prompt, provider },
        });

        // Handle WP_Error responses which come back as objects with 'code' and 'message' properties
        if (response.code && response.message) {
            // Special handling for content moderation errors
            if (response.code === 'content_moderation') {
                throw new Error(response.message);
            }
            // Handle other specific error codes as needed
            if (response.code === 'replicate_error') {
                throw new Error('Image generation failed: ' + response.message);
            }
            // Generic error handling for other WP_Error responses
            throw new Error(response.message);
        }

        // Handle successful response with URL
        if (response && response.url) {
            callback({
                url: response.url,
                alt: prompt,
                id: response.id || `ai-generated-${Date.now()}`,
                caption: '',
            });
        } else {
            // Handle invalid response format
            throw new Error('Invalid response from server: ' + JSON.stringify(response));
        }
    } catch (error) {
        // Log detailed error information
        console.error('Image generation failed:', error);
        if (error.message) console.error('Error message:', error.message);
        if (error.stack) console.error('Error stack:', error.stack);
        
        // Pass the error back to the callback
        callback({ 
            error: error.message || 'An unknown error occurred while generating the image'
        });
    }
}; 