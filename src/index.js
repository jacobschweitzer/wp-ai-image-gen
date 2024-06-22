/**
 * Registers a new block provided a unique name and an object defining its behavior.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
 * All files containing `style` keyword are bundled together. The code used
 * gets applied both to the front of your site and to the editor.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './style.scss';

/**
 * Internal dependencies
 */
import Edit from './edit';
import save from './save';
import metadata from './block.json';

// ... existing imports ...
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useState } from '@wordpress/element';
import { Button, TextControl, Modal } from '@wordpress/components';

// Line 6: Function to generate the image
const generateImage = (prompt, onSelect) => {
    wp.apiFetch({
        path: '/wp-ai-image-gen/v1/generate-image',
        method: 'POST',
        data: { prompt },
    })
        .then((response) => {
            if (response && response.url) {
                onSelect({
                    url: response.url,
                    alt: prompt,
                    id: response.id,
                });
            }
        })
        .catch((error) => {
            console.error('Error fetching image:', error);
        });
};

// Line 24: Higher-order component to modify the image block
const withImageGeneration = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        if (props.name !== 'core/image') {
            return <BlockEdit {...props} />;
        }

        const { MediaUpload } = wp.blockEditor;

        return (
            <MediaUpload
                onSelect={(media) => props.setAttributes({ ...media })}
                allowedTypes={['image']}
                value={props.attributes.id}
                render={({ open }) => (
                    <BlockEdit
                        {...props}
                        openMediaLibrary={open}
                    />
                )}
            />
        );
    };
}, 'withImageGeneration');

// Line 47: Updated AITab component
const AITab = ({ onSelect }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prompt, setPrompt] = useState('');

    // Line 52: Function to handle image generation and close modal
    const handleGenerate = () => {
        generateImage(prompt, onSelect);
        setIsModalOpen(false);
    };

    return (
        <>
            {/* Line 59: Button to open modal */}
            <div className="block-editor-media-placeholder__url-input-container">
                <Button
                    variant="tertiary"
                    onClick={() => setIsModalOpen(true)}
                    className="block-editor-media-placeholder__button"
                >
                    Generate AI Image
                </Button>
            </div>

            {/* Line 69: Modal with text input and generate button */}
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
                    >
                        Generate Image
                    </Button>
                </Modal>
            )}
        </>
    );
};

// Line 79: Filter to add the AI tab to the media modal
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

// Line 89: Apply the higher-order component
addFilter(
    'editor.BlockEdit',
    'wp-ai-image-gen/with-image-generation',
    withImageGeneration
);

/**
 * Every block starts by registering a new block type definition.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
 */
registerBlockType( metadata.name, {
	/**
	 * @see ./edit.js
	 */
	edit: Edit,

	/**
	 * @see ./save.js
	 */
	save,
} );
