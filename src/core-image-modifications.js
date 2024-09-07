// Import necessary WordPress components and hooks
import { addFilter } from '@wordpress/hooks';
import { useState, useEffect } from '@wordpress/element';
import { Button, TextControl, Modal, Spinner, SelectControl, ToolbarButton } from '@wordpress/components';
import { registerFormatType, toggleFormat } from '@wordpress/rich-text';
import { BlockControls } from '@wordpress/block-editor';
import { useSelect, useDispatch } from '@wordpress/data';
import { useCallback } from '@wordpress/element';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody } from '@wordpress/components';

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
 * Generates an AI image based on the given prompt and provider.
 * @param {string} prompt - The text prompt for image generation.
 * @param {string} provider - The selected provider ID.
 * @param {function} callback - Function to handle the generated image data.
 */
const generateImage = async (prompt, provider, callback) => {
    try {        
        // Call the WordPress API to generate the image
        const response = await wp.apiFetch({
            path: '/wp-ai-image-gen/v1/generate-image',
            method: 'POST',
            data: { prompt, provider },
        });

        // If the response contains a valid URL, call the callback with image data
        if (response && response.url) {
            callback({
                url: response.url,
                alt: prompt,
                id: response.id || `ai-generated-${Date.now()}`, // Fallback ID if not provided
                caption: '',
            });
        } else {
            // If the response doesn't contain a URL, throw an error
            throw new Error('Invalid response from server: ' + JSON.stringify(response));
        }
    } catch (error) {
        // Log the detailed error and call the callback with an error object
        console.error('Detailed error in generateImage:', error);
        if (error.message) console.error('Error message:', error.message);
        if (error.stack) console.error('Error stack:', error.stack);
        callback({ error: error.message || 'Unknown error occurred' });
    }
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

// Add this new component after the AITab component
/**
 * RegenerateAIImage component for regenerating AI images in the core image block.
 * @param {Object} props - Component props
 * @param {Object} props.attributes - Block attributes
 * @param {function} props.setAttributes - Function to update block attributes
 */
const RegenerateAIImage = ({ attributes, setAttributes }) => {
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [error, setError] = useState(null);
    const [lastUsedProvider, setLastUsedProvider] = useState('');

    // Fetch the last used provider when the component mounts
    useEffect(() => {
        const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
        if (storedProvider) {
            setLastUsedProvider(storedProvider);
        }
    }, []);

    // Handler for regenerating the AI image
    const handleRegenerate = () => {
        setIsRegenerating(true);
        setError(null);
        
        generateImage(attributes.alt, lastUsedProvider, (result) => {
            setIsRegenerating(false);
            if (result.error) {
                setError(result.error);
                console.error('Image regeneration failed:', result.error);
            } else {
                setAttributes({
                    url: result.url,
                    id: result.id,
                });
            }
        });
    };

    return (
        <PanelBody title="WP AI Image Gen">
            <Button
                variant="secondary"
                onClick={handleRegenerate}
                disabled={isRegenerating || !lastUsedProvider}
                isBusy={isRegenerating}
            >
                {isRegenerating ? 'Regenerating...' : 'Regenerate AI Image'}
            </Button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </PanelBody>
    );
};

// Register the custom format type for AI image generation from selected text
registerFormatType('wp-ai-image-gen/custom-format', {
    title: 'AI Image Gen',
    tagName: 'span',
    className: 'wp-ai-image-gen-format',
    edit: ({ isActive, value, onChange }) => {
        const [lastUsedProvider, setLastUsedProvider] = useState('');
        const [isGenerating, setIsGenerating] = useState(false);

        const selectedBlock = useSelect(select => 
            select('core/block-editor').getSelectedBlock()
        , []);

        const { replaceBlocks } = useDispatch('core/block-editor');

        // Fetch the last used provider from localStorage when the component mounts
        useEffect(() => {
            const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
            if (storedProvider) {
                setLastUsedProvider(storedProvider);
            }
        }, []);

        const handleGenerateImage = useCallback(() => {
            if (selectedBlock && selectedBlock.name === 'core/paragraph') {
                const selectedText = value.text;
                
                // Create and insert a placeholder heading block with a message
                const placeholderBlock = wp.blocks.createBlock('core/heading', {
                    content: 'Generating AI image...',
                    level: 2,
                    style: {
                        textAlign: 'center',
                    },
                });
                replaceBlocks(selectedBlock.clientId, [placeholderBlock, selectedBlock]);
                
                setIsGenerating(true);
                
                generateImage(selectedText, lastUsedProvider, (result) => {
                    setIsGenerating(false);
                    
                    if (result.error) {
                        console.error('Image generation failed:', result.error);
                        wp.data.dispatch('core/notices').createErrorNotice(
                            'Failed to generate image: ' + result.error,
                            { type: 'snackbar' }
                        );
                        // Remove the placeholder block if there's an error
                        replaceBlocks(placeholderBlock.clientId, []);
                    } else {
                        const imageBlock = wp.blocks.createBlock('core/image', {
                            url: result.url,
                            alt: result.alt,
                            caption: '',
                            id: result.id || `ai-generated-${Date.now()}`, // Ensure ID is set
                        });
                        // Replace the placeholder block with the new image block
                        replaceBlocks(placeholderBlock.clientId, [imageBlock]);
                    }
                });
            }
        }, [selectedBlock, value.text, replaceBlocks, lastUsedProvider]);

        return (
            <BlockControls>
                <ToolbarButton
                    icon={isGenerating ? <Spinner /> : "art"}
                    title={isGenerating ? "Generating AI Image..." : "Generate AI Image"}
                    onClick={handleGenerateImage}
                    isActive={isActive}
                    disabled={isGenerating}
                />
            </BlockControls>
        );
    },
});

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

// Modify the existing addFilter function at the end of the file
addFilter('editor.BlockEdit', 'wp-ai-image-gen/add-regenerate-button', (BlockEdit) => {
    return (props) => {
        if (props.name !== 'core/image') {
            return <BlockEdit {...props} />;
        }

        return (
            <>
                <BlockEdit {...props} />
                <InspectorControls>
                    <RegenerateAIImage
                        attributes={props.attributes}
                        setAttributes={props.setAttributes}
                    />
                </InspectorControls>
            </>
        );
    };
});
