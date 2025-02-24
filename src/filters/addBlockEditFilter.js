// This file modifies the block editor for core/image blocks to include an AI image regeneration button.

import { addFilter } from '@wordpress/hooks'; // Import the addFilter function.
import { useState, useEffect } from '@wordpress/element'; // Import necessary React hooks.
import { BlockControls } from '@wordpress/block-editor'; // Import BlockControls for toolbar.
import AIImageToolbar from '../components/AIImageToolbar'; // Import the AIImageToolbar component.
import { fetchProviders, generateImage } from '../api'; // Import API functions for provider fetching and image generation.

/**
 * Enhances the core/image block with an AI image regeneration button.
 *
 * @param {function} BlockEdit - The original BlockEdit component.
 * @returns {function} A new BlockEdit component with additional regeneration functionality.
 */
addFilter('editor.BlockEdit', 'wp-ai-image-gen/add-regenerate-button', (BlockEdit) => {
    // Return a new functional component that wraps the original BlockEdit.
    return (props) => {
        // Only modify core/image blocks.
        if (props.name !== 'core/image') {
            return <BlockEdit {...props} />;
        }

        // State to manage regeneration progress, provider selection, and errors.
        const [isRegenerating, setIsRegenerating] = useState(false); // Indicates if regeneration is in progress.
        const [lastUsedProvider, setLastUsedProvider] = useState(''); // Stores the last used provider.
        const [error, setError] = useState(null); // Holds error messages if any.

        // Initialize the last used provider on component mount.
        useEffect(() => {
            const initializeProvider = async () => { // Async function to initialize provider.
                try {
                    const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
                    if (storedProvider) {
                        // Verify that the stored provider is still available.
                        const availableProviders = await fetchProviders();
                        if (!availableProviders.error && availableProviders.includes(storedProvider)) {
                            setLastUsedProvider(storedProvider);
                            return;
                        }
                    }
                    // If no valid provider was stored, fetch and use the first available provider.
                    const result = await fetchProviders();
                    if (!result.error && result.length > 0) {
                        const defaultProvider = result[0];
                        setLastUsedProvider(defaultProvider);
                        localStorage.setItem('wpAiImageGenLastProvider', defaultProvider);
                    }
                } catch (err) {
                    // Log an error and display a notice if initialization fails.
                    console.error('Failed to initialize provider:', err);
                    wp.data.dispatch('core/notices').createErrorNotice(
                        'Failed to initialize AI provider. Please try again.',
                        { type: 'snackbar' }
                    );
                }
            };

            initializeProvider(); // Run provider initialization.
        }, []);

        /**
         * Handles the AI image regeneration process for the current image block.
         *
         * @returns {Promise<void>} A promise that resolves when regeneration is complete.
         */
        const handleRegenerateImage = async () => { // This function regenerates the image.
            setError(null); // Clear any previous errors.

            // Validate that there is alt text available to use as a prompt.
            if (!props.attributes.alt || props.attributes.alt.trim() === '') {
                wp.data.dispatch('core/notices').createErrorNotice(
                    'Please provide alt text to use as the image generation prompt.',
                    { type: 'snackbar' }
                );
                return;
            }

            // Ensure there is a valid provider in use.
            if (!lastUsedProvider) {
                try {
                    const providers = await fetchProviders(); // Fetch providers if necessary.
                    if (providers.error || providers.length === 0) {
                        wp.data.dispatch('core/notices').createErrorNotice(
                            'No AI provider available. Please check your settings.',
                            { type: 'snackbar' }
                        );
                        return;
                    }
                    setLastUsedProvider(providers[0]); // Use the first provider.
                } catch (err) {
                    wp.data.dispatch('core/notices').createErrorNotice(
                        'Failed to fetch AI providers. Please try again.',
                        { type: 'snackbar' }
                    );
                    return;
                }
            }

            setIsRegenerating(true); // Indicate that regeneration is starting.

            try {
                // Wrap the generateImage call in a promise.
                const result = await new Promise((resolve, reject) => {
                    generateImage(props.attributes.alt.trim(), lastUsedProvider, (result) => {
                        if (result.error) {
                            reject(new Error(result.error));
                        } else {
                            resolve(result);
                        }
                    });
                });

                // Update the block attributes with the new image data.
                props.setAttributes({
                    url: result.url,
                    id: result.id || `ai-generated-${Date.now()}`, // Use a fallback ID if necessary.
                });

                // Display a success notice on regeneration.
                wp.data.dispatch('core/notices').createSuccessNotice(
                    'Image regenerated successfully!',
                    { type: 'snackbar' }
                );
            } catch (err) {
                console.error('Image regeneration failed:', err); // Log the error.
                wp.data.dispatch('core/notices').createErrorNotice(
                    'Failed to regenerate image: ' + (err.message || 'Unknown error'),
                    { type: 'snackbar' }
                );
            } finally {
                setIsRegenerating(false); // Reset the regeneration state.
            }
        };

        return (
            <>
                <BlockEdit {...props} /> {/* Render the default BlockEdit component. */}
                <BlockControls>
                    <AIImageToolbar
                        isRegenerating={isRegenerating}
                        onRegenerateImage={handleRegenerateImage}
                        isImageBlock={true} // Always true for core/image blocks.
                    />
                </BlockControls>
            </>
        );
    };
});
