// Import necessary WordPress components and hooks
import { addFilter } from '@wordpress/hooks';
import { useState } from '@wordpress/element';
import { Button, TextControl, Modal, Spinner } from '@wordpress/components';

/**
 * Generates an AI image based on the given prompt
 * @param {string} prompt - The text prompt for image generation
 * @param {function} callback - Function to handle the generated image data
 */
const generateImage = (prompt, callback) => {
    // Call the WordPress API to generate the image
    wp.apiFetch({
        path: '/wp-ai-image-gen/v1/generate-image',
        method: 'POST',
        data: { prompt },
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
    // State hooks for modal, prompt, and loading status
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Handler for image generation
    const handleGenerate = () => {
        setIsLoading(true);
        generateImage(prompt, (media) => {
            onSelect(media);
            setIsLoading(false);
            setIsModalOpen(false);
        });
    };

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
                        disabled={isLoading}
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
