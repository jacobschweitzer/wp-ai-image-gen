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
            <Button isPrimary onClick={fetchImage}>
                Generate Image
            </Button>
            {attributes.imageUrl && (
                <div className="generated-image">
                    <img src={attributes.imageUrl} alt="Generated Image" />
                </div>
            )}
        </div>
    );
};

export default Edit;
