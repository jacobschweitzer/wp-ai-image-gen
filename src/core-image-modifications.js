// Import necessary WordPress components and hooks
import { addFilter } from '@wordpress/hooks';
import { useState, useEffect } from '@wordpress/element';
import { Button, TextControl, Modal, Spinner, SelectControl } from '@wordpress/components';

/**
 * Fetches available providers from the server.
 * @returns {Promise<Object>} A promise that resolves to an object of provider IDs and names.
 */
const fetchProviders = async () => {
    try {
        const response = await wp.apiFetch({ path: '/wp-ai-image-gen/v1/providers' });
        return response;
    } catch (error) {
        console.error('Error fetching providers:', error);
        // Return an object with an error message that can be displayed to the user
        return { error: 'Unable to fetch providers. Please try again later.' };
    }
};

/**
 * Generates an AI image based on the given prompt and provider
 * @param {string} prompt - The text prompt for image generation
 * @param {string} provider - The selected provider ID
 * @param {function} callback - Function to handle the generated image data
 */
const generateImage = (prompt, provider, callback) => {
    // Call the WordPress API to generate the image
    wp.apiFetch({
        path: '/wp-ai-image-gen/v1/generate-image',
        method: 'POST',
        data: { prompt, provider },
    })
        .then((response) => {
            // If the response contains a valid URL, call the callback with image data
            if (response && response.url) {
                callback({
                    url: response.url,
                    alt: prompt,
                    id: response.id,
                });
            }
        })
        .catch((error) => {
            // Log any errors and call the callback with null
            console.error('Error fetching image:', error);
            callback(null);
        });
};

/**
 * AITab component for generating AI images
 * @param {Object} props - Component props
 * @param {function} props.onSelect - Function to handle selected image
 */
const AITab = ({ onSelect }) => {
    // State hooks for modal, prompt, loading status, providers, and selected provider
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [providers, setProviders] = useState({});
    const [selectedProvider, setSelectedProvider] = useState('');
    const [error, setError] = useState(null);

    // Add a new state hook for the last used provider
    const [lastUsedProvider, setLastUsedProvider] = useState('');

    // Fetch providers and last used provider when component mounts
    useEffect(() => {
        fetchProviders().then((result) => {
            if (result.error) {
                setError(result.error);
            } else {
                setProviders(result);
                // Retrieve the last used provider from local storage
                const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
                if (storedProvider && result[storedProvider]) {
                    setSelectedProvider(storedProvider);
                    setLastUsedProvider(storedProvider);
                } else {
                    // If no stored provider or it's invalid, use the first available provider
                    setSelectedProvider(Object.keys(result)[0]);
                }
            }
        });
    }, []);

    // Update local storage when the selected provider changes
    useEffect(() => {
        if (selectedProvider) {
            localStorage.setItem('wpAiImageGenLastProvider', selectedProvider);
            setLastUsedProvider(selectedProvider);
        }
    }, [selectedProvider]);

    // Handler for image generation
    const handleGenerate = () => {
        setIsLoading(true);
        generateImage(prompt, selectedProvider, (media) => {
            onSelect(media);
            setIsLoading(false);
            setIsModalOpen(false);
        });
    };

    // Prepare provider options for dropdown
    const providerOptions = Object.entries(providers).map(([id, name]) => ({ value: id, label: name }));

    return (
        <>
            {/* Button to open the AI image generation modal */}
            <div className="block-editor-media-placeholder__url-input-container">
                <Button
                    variant="tertiary"
                    onClick={() => setIsModalOpen(true)}
                    className="block-editor-media-placeholder__button"
                >
                    Generate AI Image
                </Button>
            </div>

            {/* Modal for AI image generation */}
            {isModalOpen && (
                <Modal
                    title="WP AI Image Gen"
                    onRequestClose={() => setIsModalOpen(false)}
                >
                    {error ? (
                        <p style={{ color: 'red' }}>{error}</p>
                    ) : (
                        <>
                            {/* Provider dropdown (only if there's more than one provider) */}
                            {providerOptions.length > 1 && (
                                <SelectControl
                                    label="Select Provider"
                                    value={selectedProvider}
                                    options={providerOptions}
                                    onChange={setSelectedProvider}
                                />
                            )}
                            {/* Input field for the image prompt */}
                            <TextControl
                                label="Enter your image prompt"
                                value={prompt}
                                onChange={setPrompt}
                            />
                            {/* Button to trigger image generation */}
                            <Button
                                variant="primary"
                                onClick={handleGenerate}
                                disabled={isLoading || !selectedProvider || Object.keys(providers).length === 0}
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner />
                                        Generating...
                                    </>
                                ) : (
                                    'Generate Image'
                                )}
                            </Button>
                        </>
                    )}
                </Modal>
            )}
        </>
    );
};

// Add the AI tab to the media modal using WordPress filter
addFilter('editor.MediaUpload', 'wp-ai-image-gen/add-ai-tab', (OriginalMediaUpload) => {
    // Return a new component that wraps the original MediaUpload
    return (props) => {
        return (
            <OriginalMediaUpload
                {...props}
                render={(originalProps) => (
                    <>
                        {/* Render the original MediaUpload component */}
                        {props.render(originalProps)}
                        {/* Add the AITab component */}
                        <AITab onSelect={props.onSelect} />
                    </>
                )}
            />
        );
    };
});
