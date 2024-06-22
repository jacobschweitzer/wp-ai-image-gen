
// ... existing imports ...
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useState } from '@wordpress/element';
import { Button, TextControl, Modal, Spinner } from '@wordpress/components';

// Function to generate the image.
const generateImage = (prompt, callback) => {
    // Call the API to generate the image.
    wp.apiFetch({
        path: '/wp-ai-image-gen/v1/generate-image',
        method: 'POST',
        data: { prompt },
    })
        .then((response) => {
            // If the response is successful, call the callback with the image URL.
            if (response && response.url) {
                // Call the callback with the image URL, alt text, and ID.
                callback({
                    url: response.url,
                    alt: prompt,
                    id: response.id,
                });
            }
        })
        // If there is an error, call the callback with null.
        .catch((error) => {
            // Log the error.
            console.error('Error fetching image:', error);
            // Call the callback with null.
            callback(null);
        });
};

// Updated AITab component.
const AITab = ({ onSelect }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);

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
            <div className="block-editor-media-placeholder__url-input-container">
                <Button
                    variant="tertiary"
                    onClick={() => setIsModalOpen(true)}
                    className="block-editor-media-placeholder__button"
                >
                    Generate AI Image
                </Button>
            </div>

            {isModalOpen && (
                <Modal
                    title="Generate AI Image"
                    onRequestClose={() => setIsModalOpen(false)}
                >
                    <TextControl
                        label="Enter your image prompt"
                        value={prompt}
                        onChange={setPrompt}
                    />
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

// Filter to add the AI tab to the media modal.
addFilter('editor.MediaUpload', 'wp-ai-image-gen/add-ai-tab', (OriginalMediaUpload) => {
    return (props) => {
        return (
            <OriginalMediaUpload
                {...props}
                render={(originalProps) => (
                    <>
                        {props.render(originalProps)}
                        <AITab onSelect={props.onSelect} />
                    </>
                )}
            />
        );
    };
});


