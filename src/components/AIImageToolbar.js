// This file contains the AIImageToolbar component used in block toolbars for AI image actions.

import { Spinner, ToolbarButton, ToolbarGroup } from '@wordpress/components'; // Import necessary toolbar components.

/**
 * AIImageToolbar component for adding AI image generation or regeneration buttons.
 *
 * @param {Object} props - Component properties.
 * @param {boolean} props.isGenerating - Indicates if an image is currently being generated.
 * @param {Function} props.onGenerateImage - Callback to handle image generation.
 * @param {boolean} [props.isRegenerating] - Indicates if an image is being regenerated.
 * @param {Function} [props.onRegenerateImage] - Callback to handle image regeneration.
 * @param {boolean} [props.isImageBlock] - Determines if the current block is an image block.
 * @param {boolean} [props.isTextSelected] - Determines if text is selected to trigger generation.
 * @returns {JSX.Element|null} Returns the toolbar with the appropriate button or null if conditions are unmet.
 */
const AIImageToolbar = ({
    isGenerating,
    onGenerateImage,
    isRegenerating,
    onRegenerateImage,
    isImageBlock,
    isTextSelected,
}) => { // This functional component returns toolbar buttons based on the context of the block.
    // Render a regenerate button if the current block is an image block.
    if (isImageBlock) {
        return (
            <ToolbarGroup>
                <ToolbarButton
                    icon={isRegenerating ? <Spinner /> : "update"} // Show spinner when regenerating.
                    label={isRegenerating ? "Regenerating AI Image..." : "Regenerate AI Image"} // Button label based on state.
                    onClick={onRegenerateImage} // Invokes the regeneration handler.
                    disabled={isRegenerating} // Disables the button when a regeneration is in progress.
                />
            </ToolbarGroup>
        );
    }
    // Render a generate button if text is selected.
    else if (isTextSelected) {
        return (
            <ToolbarGroup>
                <ToolbarButton
                    icon={isGenerating ? <Spinner /> : "format-image"} // Show spinner when generating.
                    label={isGenerating ? "Generating AI Image..." : "Generate AI Image"} // Button label based on generation status.
                    onClick={onGenerateImage} // Invokes the generation handler.
                    disabled={isGenerating} // Disables the button during generation.
                />
            </ToolbarGroup>
        );
    }

    // Return null if neither condition is met.
    return null;
};

export default AIImageToolbar; // Export the AIImageToolbar component. 