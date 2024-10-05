// Import necessary WordPress components and hooks
import { addFilter } from '@wordpress/hooks';
import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, TextareaControl, Modal, Spinner, SelectControl, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { registerFormatType } from '@wordpress/rich-text';
import { BlockControls } from '@wordpress/block-editor';
import { useSelect, useDispatch } from '@wordpress/data';

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
            // Check for NSFW content error
            if (response && response.error && response.error.includes('NSFW content')) {
                throw new Error('The image could not be generated due to potential inappropriate content. Please try a different prompt.');
            } else {
                throw new Error('Invalid response from server: ' + JSON.stringify(response));
            }
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
 * AITab component for generating AI images.
 *
 * @param {Object} props - Component properties.
 * @param {function} props.onSelect - Function to handle selected image.
 * @param {boolean} props.shouldDisplay - Determines if the AITab should be displayed.
 * @returns {JSX.Element|null} The AITab component or null.
 */
const AITab = ({ onSelect, shouldDisplay }) => {
    // State hooks for modal, prompt, loading status, providers, and selected provider.
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [providers, setProviders] = useState({});
    const [selectedProvider, setSelectedProvider] = useState('');
    const [error, setError] = useState(null);
    const [lastUsedProvider, setLastUsedProvider] = useState('');

    // Fetch providers and last used provider when component mounts.
    useEffect(() => {
        fetchProviders().then((result) => {
            if (result.error) {
                setError(result.error);
            } else {
                setProviders(result);
            
                // Retrieve the last used provider from local storage.
                const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
                if (storedProvider && result[storedProvider]) {
                    setSelectedProvider(storedProvider);
                    setLastUsedProvider(storedProvider);
                } else {
                    // If no stored provider or it's invalid, use the first available provider.
                    setSelectedProvider(Object.keys(result)[0]);
                }
            }
        });
    }, []);

    // Update local storage when the selected provider changes.
    useEffect(() => {
        if (selectedProvider) {
            localStorage.setItem('wpAiImageGenLastProvider', selectedProvider);
            setLastUsedProvider(selectedProvider);
        }
    }, [selectedProvider]);

    /**
     * Handler for image generation.
     */
    const handleGenerate = () => {
        // Check if the prompt is empty or only whitespace.
        if (!prompt.trim()) {
            setError('Please enter a prompt for image generation.');
            return;
        }

        setIsLoading(true);
        setError(null); // Clear any previous errors.
        generateImage(prompt.trim(), selectedProvider, (media) => {
            if (media.error) {
                setError(media.error);
                setIsLoading(false);
            } else {
                onSelect(media);
                setIsLoading(false);
                setIsModalOpen(false);
            }
        });
    };

    // Prepare provider options for dropdown.
    const providerOptions = Object.entries(providers).map(([id, name]) => ({ value: id, label: name }));

    // If shouldDisplay is false, do not render the button and modal.
    if (!shouldDisplay) {
        return null;
    }

    return (
        <>
            {/* Button to open the AI image generation modal */}
            <div className="block-editor-media-placeholder__url-input-container">
                <Button
                    variant="secondary" // Secondary styling for the button.
                    onClick={() => setIsModalOpen(true)} // Open the modal on click.
                    className="block-editor-media-placeholder__button is-secondary" // Additional styling class.
                >
                    Generate AI Image
                </Button>
            </div>

            {/* Modal for AI image generation */}
            {isModalOpen && (
                <Modal
                    title="WP AI Image Gen" // Modal title.
                    onRequestClose={() => setIsModalOpen(false)} // Close modal on request.
                >
                    {/* Display error message if any */}
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    
                    {/* Provider dropdown; visible only if multiple providers exist */}
                    {providerOptions.length > 1 && (
                        <SelectControl
                            label="Select Provider"
                            value={selectedProvider}
                            options={providerOptions}
                            onChange={setSelectedProvider}
                        />
                    )}
                    
                    {/* Input field for the image prompt */}
                    <TextareaControl
                        label="Enter your image prompt"
                        value={prompt}
                        onChange={setPrompt}
                        rows={4}
                    />
                    
                    {/* Button to trigger image generation */}
                    <Button
                        variant="primary" // Primary styling for the button.
                        onClick={handleGenerate} // Trigger image generation on click.
                        disabled={isLoading || !selectedProvider || !prompt.trim()} // Disable if loading or inputs missing.
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
                </Modal>
            )}
        </>
    );
};

/**
 * AIImageToolbar component for adding buttons to toolbars.
 * This component handles both image regeneration and image generation based on text selection.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.isGenerating - Indicates if an image is currently being generated.
 * @param {Function} props.onGenerateImage - Function to handle image generation.
 * @param {boolean} props.isRegenerating - Indicates if an image is currently being regenerated.
 * @param {Function} props.onRegenerateImage - Function to handle image regeneration.
 * @param {boolean} props.isImageBlock - Indicates if the current block is an image block.
 * @param {boolean} props.isTextSelected - Indicates if text is selected within the block.
 * @returns {JSX.Element|null} The rendered toolbar buttons or null.
 */
const AIImageToolbar = ({
    isGenerating,
    onGenerateImage,
    isRegenerating,
    onRegenerateImage,
    isImageBlock,
    isTextSelected,
}) => {
    // If the block is an image block, render the regenerate button with appropriate states.
    if (isImageBlock) {
        return (
            <ToolbarGroup>
                <ToolbarButton
                    icon={isRegenerating ? <Spinner /> : "update"}
                    label={isRegenerating ? "Regenerating AI Image..." : "Regenerate AI Image"}
                    onClick={onRegenerateImage}
                    disabled={isRegenerating}
                />
            </ToolbarGroup>
        );
    } 
    // If text is selected, render the generate button.
    else if (isTextSelected) {
        return (
            <ToolbarGroup>
                <ToolbarButton
                    icon={isGenerating ? <Spinner /> : "format-image"}
                    label={isGenerating ? "Generating AI Image..." : "Generate AI Image"}
                    onClick={onGenerateImage}
                    disabled={isGenerating}
                />
            </ToolbarGroup>
        );
    }

    // Return null if conditions are not met.
    return null;
};

/**
 * Modifies the existing registerFormatType function to include the regenerate button.
 *
 * @param {function} BlockEdit - The original BlockEdit component.
 * @returns {function} The modified BlockEdit component with AI image functionality.
 */
registerFormatType('wp-ai-image-gen/custom-format', {
    title: 'AI Image Gen',
    tagName: 'span',
    className: 'wp-ai-image-gen-format',
    edit: ({ isActive, value, onChange }) => {
        // State hooks for handling image generation states and selected provider.
        const [lastUsedProvider, setLastUsedProvider] = useState('');
        const [isGenerating, setIsGenerating] = useState(false);
        const selectedBlock = useSelect(select => 
            select('core/block-editor').getSelectedBlock()
        , []);
        const { replaceBlocks } = useDispatch('core/block-editor');

        // Fetch the last used provider from localStorage when the component mounts.
        useEffect(() => {
            const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
            if (storedProvider) {
                setLastUsedProvider(storedProvider);
            }
        }, []);

        /**
         * Handles the image generation process based on the selected text.
         */
        const handleGenerateImage = useCallback(() => {
            if (selectedBlock && selectedBlock.name === 'core/paragraph') {
                const selectedText = value.text.slice(value.start, value.end).trim();
                
                // Check if selected text exists and is not empty.
                if (!selectedText) {
                    wp.data.dispatch('core/notices').createErrorNotice(
                        'Please select some text to use as the image generation prompt.',
                        { type: 'snackbar' }
                    );
                    return;
                }
                
                // Create and insert a placeholder heading block with a message.
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
                        // Remove the placeholder block if there's an error.
                        replaceBlocks(placeholderBlock.clientId, []);
                    } else {
                        const imageBlock = wp.blocks.createBlock('core/image', {
                            url: result.url,
                            alt: result.alt,
                            caption: '',
                            id: result.id || `ai-generated-${Date.now()}`, // Ensure ID is set.
                        });
                        // Replace the placeholder block with the new image block.
                        replaceBlocks(placeholderBlock.clientId, [imageBlock]);
                    }
                });
            }
        }, [selectedBlock, value.text, value.start, value.end, replaceBlocks, lastUsedProvider]);

        // Extract the selected text and determine if any text is selected.
        const selectedText = value.text.slice(value.start, value.end).trim();
        const isTextSelected = selectedText !== "";

        return (
            <BlockControls>
                <AIImageToolbar
                    isGenerating={isGenerating}
                    onGenerateImage={handleGenerateImage}
                    isTextSelected={isTextSelected}
                />
            </BlockControls>
        );
    },
});

// Add the AI tab to the media modal using WordPress filter
addFilter('editor.MediaUpload', 'wp-ai-image-gen/add-ai-tab', (OriginalMediaUpload) => {
    /**
     * Enhances the original MediaUpload component by adding the AITab.
     *
     * @param {Object} props - Props passed to the MediaUpload component.
     * @returns {JSX.Element} The enhanced MediaUpload component.
     */
    return (props) => {
        // Determine if the MediaUpload is for a single image block by checking if multiple is false or undefined.
        const isSingleImageBlock = props.allowedTypes && props.allowedTypes.includes('image') && !props.multiple;

        // Retrieve the currently selected block using wp.data.
        const selectedBlock = wp.data.select('core/block-editor').getSelectedBlock();

        // Check if the selected block is an image block.
        const isImageBlock = selectedBlock && selectedBlock.name === 'core/image';

        // Determine if AITab should be displayed.
        const shouldDisplay = isSingleImageBlock && isImageBlock;

        return (
            <OriginalMediaUpload
                {...props}
                render={(originalProps) => (
                    <>
                        {/* Render the original MediaUpload component */}
                        {props.render(originalProps)}
                        {/* Add the AITab component only if it's a single image block */}
                        <AITab 
                            onSelect={props.onSelect} 
                            shouldDisplay={shouldDisplay} 
                        />
                    </>
                )}
            />
        );
    };
});

/**
 * Adds the regenerate button to image blocks in the editor.
 *
 * @param {function} BlockEdit - The original BlockEdit component.
 * @returns {function} The modified BlockEdit component with AI image regeneration functionality.
 */
addFilter('editor.BlockEdit', 'wp-ai-image-gen/add-regenerate-button', (BlockEdit) => {
    return (props) => {
        const [isRegenerating, setIsRegenerating] = useState(false);
        const [lastUsedProvider, setLastUsedProvider] = useState('');
        const [error, setError] = useState(null);

        // Fetch the last used provider from localStorage when the component mounts.
        useEffect(() => {
            const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
            if (storedProvider) {
                setLastUsedProvider(storedProvider);
            }
        }, []);

        /**
         * Handles the image regeneration process.
         */
        const handleRegenerateImage = () => {
            // Check if alt text exists and is not empty.
            if (!props.attributes.alt || props.attributes.alt.trim() === '') {
                wp.data.dispatch('core/notices').createErrorNotice(
                    'Please provide alt text to use as the image generation prompt.',
                    { type: 'snackbar' }
                );
                return;
            }

            setIsRegenerating(true);
            generateImage(props.attributes.alt.trim(), lastUsedProvider, (result) => {
                setIsRegenerating(false);
                if (result.error) {
                    console.error('Image regeneration failed:', result.error);
                    wp.data.dispatch('core/notices').createErrorNotice(
                        'Failed to regenerate image: ' + result.error,
                        { type: 'snackbar' }
                    );
                } else {
                    props.setAttributes({
                        url: result.url,
                        id: result.id || `ai-generated-${Date.now()}`,
                    });
                }
            });
        };

        // Only modify the core/image block.
        if (props.name !== 'core/image') {
            return <BlockEdit {...props} />;
        }

        return (
            <>
                <BlockEdit {...props} />
                <BlockControls>
                    <AIImageToolbar
                        isRegenerating={isRegenerating}
                        onRegenerateImage={handleRegenerateImage}
                        isImageBlock={true}
                    />
                </BlockControls>
            </>
        );
    };
});