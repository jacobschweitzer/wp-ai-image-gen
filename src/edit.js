import { TextControl, Button } from '@wordpress/components';
import { useBlockProps } from '@wordpress/block-editor';
import { useState } from '@wordpress/element';

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
