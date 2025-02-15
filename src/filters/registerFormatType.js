// This file registers a new rich-text format which uses BlockControls to trigger AI image generation.

import { useEffect, useCallback, useState } from '@wordpress/element'; // Import React hooks.
import { BlockControls } from '@wordpress/block-editor'; // Import BlockControls from the block editor.
import { useSelect, useDispatch } from '@wordpress/data'; // Import necessary data hooks.
import { registerFormatType } from '@wordpress/rich-text'; // Import registerFormatType.
import AIImageToolbar from '../components/AIImageToolbar'; // Import the AIImageToolbar component.
import { generateImage } from '../api'; // Import API function for image generation.

/**
 * Registers the AI Image Generation format type and integrates BlockControls.
 *
 * @returns {void}
 */
registerFormatType('wp-ai-image-gen/custom-format', {
    title: 'AI Image Gen',
    tagName: 'span',
    className: 'wp-ai-image-gen-format',
    edit: ({ isActive, value, onChange }) => { // This edit function adds AI image functionality to the block.
        // Create state for the last used provider and generation state.
        const [lastUsedProvider, setLastUsedProvider] = useState(''); // Stores the last used provider.
        const [isGenerating, setIsGenerating] = useState(false); // Indicates if an image is being generated.

        // Retrieve the currently selected block.
        const selectedBlock = useSelect((select) => select('core/block-editor').getSelectedBlock(), []);
        // Get the dispatch function to replace blocks.
        const { replaceBlocks } = useDispatch('core/block-editor');

        // Fetch the last used provider from localStorage when the component mounts.
        useEffect(() => {
            const storedProvider = localStorage.getItem('wpAiImageGenLastProvider');
            if (storedProvider) {
                setLastUsedProvider(storedProvider);
            }
        }, []);

        /**
         * Handles the AI image generation process based on the selected text.
         *
         * @returns {void}
         */
        const handleGenerateImage = useCallback(() => { // This function manages image generation.
            if (selectedBlock && selectedBlock.name === 'core/paragraph') {
                // Extract the currently selected text.
                const selectedText = value.text.slice(value.start, value.end).trim();
                if (!selectedText) {
                    // Create an error notice if no text is selected.
                    wp.data.dispatch('core/notices').createErrorNotice(
                        'Please select some text to use as the image generation prompt.',
                        { type: 'snackbar' }
                    );
                    return;
                }
                
                // Create a placeholder block to show that image generation is in progress.
                const placeholderBlock = wp.blocks.createBlock('core/heading', {
                    content: 'Generating AI image...',
                    level: 2,
                    style: {
                        textAlign: 'center',
                    },
                });
                // Replace the selected block with the placeholder.
                replaceBlocks(selectedBlock.clientId, [placeholderBlock, selectedBlock]);
                
                setIsGenerating(true); // Set generating state.

                // Call the API function to generate the image.
                generateImage(selectedText, lastUsedProvider, (result) => {
                    setIsGenerating(false); // Reset generating state.
                    
                    if (result.error) {
                        console.error('Image generation failed:', result.error);
                        wp.data.dispatch('core/notices').createErrorNotice(
                            'Failed to generate image: ' + result.error,
                            { type: 'snackbar' }
                        );
                        // Remove the placeholder block on error.
                        replaceBlocks(placeholderBlock.clientId, []);
                    } else {
                        // Create a new image block with the image details.
                        const imageBlock = wp.blocks.createBlock('core/image', {
                            url: result.url,
                            alt: result.alt,
                            caption: '',
                            id: result.id || `ai-generated-${Date.now()}`, // Ensure the image block has an ID.
                        });
                        // Replace the placeholder with the new image block.
                        replaceBlocks(placeholderBlock.clientId, [imageBlock]);
                    }
                });
            }
        }, [selectedBlock, value.text, value.start, value.end, replaceBlocks, lastUsedProvider]);

        // Determine if any text is selected.
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
