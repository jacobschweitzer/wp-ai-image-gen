import { TextControl, Button } from '@wordpress/components';
import { useBlockProps } from '@wordpress/block-editor';
import { useState } from '@wordpress/element';
import { PluginSidebar } from '@wordpress/edit-post';
import { registerPlugin } from '@wordpress/plugins';
import { MediaUpload } from '@wordpress/block-editor';

// Line 7: CustomSidebar component
function CustomSidebar() {
    // State hooks for mediaId and textInput
    const [mediaId, setMediaId] = useState(0);
    const [textInput, setTextInput] = useState('');

    // Line 12: Function to handle media selection
    function onSelectMedia(media) {
        setMediaId(media.id);
    }

    // Line 16: Function to handle form submission
    function onSubmit() {
        console.log('Submitted:', { mediaId, textInput });
        // TODO: Send data to a custom endpoint using wp.apiFetch
    }

    // Line 21: Return JSX for the sidebar
    return (
        <PluginSidebar
            name="custom-sidebar"
            title="Custom Media Sidebar"
            icon="admin-media"
        >
            <div className="custom-sidebar-content">
                <MediaUpload
                    onSelect={onSelectMedia}
                    allowedTypes={['image']}
                    value={mediaId}
                    render={({ open }) => (
                        <Button
                            onClick={open}
                            isPrimary
                        >
                            {mediaId ? 'Change Image' : 'Select Image'}
                        </Button>
                    )}
                />
                <TextControl
                    label="Custom Text Input"
                    value={textInput}
                    onChange={setTextInput}
                />
                <Button
                    isPrimary
                    onClick={onSubmit}
                >
                    Submit
                </Button>
            </div>
        </PluginSidebar>
    );
}

// Line 58: Register the plugin
registerPlugin('custom-sidebar-plugin', {
    render: CustomSidebar,
    icon: 'admin-media',
});

const Edit = ({ attributes, setAttributes }) => {
    const blockProps = useBlockProps();
    const [prompt, setPrompt] = useState(attributes.prompt);
	const fetchImage = () => {
		wp.apiFetch({
			path: '/wp-ai-image-gen/v1/generate-image',
			method: 'POST',
			data: { prompt: prompt },
		})
			.then((response) => {
				if (response && response.url) {
					setAttributes({ imageUrl: response.url });
                    const { createBlock } = wp.blocks;
                    const { insertBlock } = wp.data.dispatch('core/block-editor');

                    // Create a core/image block with the image URL.
                    const imageBlock = createBlock('core/image', {
                        url: response.url,
                        alt: prompt,
                        id: response.id,
                    });

                    // Insert the new image block into the editor.
                    insertBlock(imageBlock);
				}
			})
			.catch((error) => {
				console.error('Error fetching image:', error);
			});
	};


    const handlePromptChange = (value) => {
        setPrompt(value);
        setAttributes({ prompt: value });
    };

    return (
        <div {...blockProps}>
            <TextControl
                label="Enter your image prompt"
                value={prompt}
                onChange={handlePromptChange}
            />
            <Button className="button button-primary" onClick={fetchImage}>
                Generate Image
            </Button>
        </div>
    );
};

export default Edit;
