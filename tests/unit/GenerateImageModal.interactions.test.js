import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { generateImage, fetchReferenceImages } from '../../src/api';
import GenerateImageModal from '../../src/components/GenerateImageModal';
import useGenerationProgress from '../../src/hooks/useGenerationProgress';
import {
	getKaiGenSettings,
	isKaiGenAvailable,
} from '../../src/utils/kaigenSettings';

jest.mock( '../../src/api' );
jest.mock( '../../src/hooks/useGenerationProgress' );
jest.mock( '../../src/utils/kaigenSettings' );
jest.mock( '@wordpress/components', () => {
	const element = jest.requireActual( '@wordpress/element' );

	return {
		Button: ( { children, variant, ...props } ) => {
			void variant;
			return element.createElement( 'button', props, children );
		},
		Dashicon: ( { icon } ) =>
			element.createElement( 'span', { 'data-icon': icon } ),
		Dropdown: ( { renderToggle, renderContent } ) => {
			const [ isOpen, setIsOpen ] = element.useState( false );
			const onToggle = () => setIsOpen( ( open ) => ! open );

			return element.createElement(
				element.Fragment,
				null,
				renderToggle( { isOpen, onToggle } ),
				isOpen &&
					renderContent( {
						onClose: () => setIsOpen( false ),
					} )
			);
		},
		Modal: ( { children, title, onRequestClose, ...props } ) => {
			void onRequestClose;
			return element.createElement(
				'div',
				{ role: 'dialog', ...props },
				title,
				children
			);
		},
		TextareaControl: ( { onChange, ...props } ) =>
			element.createElement( 'textarea', {
				...props,
				onChange: ( event ) => onChange( event.target.value ),
			} ),
	};
} );

describe( 'GenerateImageModal interactions', () => {
	beforeEach( () => {
		generateImage.mockReset();
		fetchReferenceImages.mockReset();
		getKaiGenSettings.mockReset();
		isKaiGenAvailable.mockReset();
		useGenerationProgress.mockReset();

		fetchReferenceImages.mockResolvedValue( [] );
		getKaiGenSettings.mockReturnValue( {
			provider: 'auto',
			orientation: 'square',
			providers: [
				{ id: 'auto', name: 'Auto', referenceImageLimit: 5 },
				{ id: 'openai', name: 'OpenAI', referenceImageLimit: 5 },
			],
		} );
		isKaiGenAvailable.mockReturnValue( true );
		useGenerationProgress.mockReturnValue( 0 );
	} );

	it( 'submits a trimmed prompt and previews the generated media', async () => {
		const user = userEvent.setup();
		const onSelect = jest.fn();
		const media = {
			id: 42,
			url: 'https://example.com/generated.png',
			alt: 'A lighthouse in a storm',
		};
		generateImage.mockResolvedValue( media );

		render(
			<GenerateImageModal
				isOpen
				onClose={ jest.fn() }
				onSelect={ onSelect }
			/>
		);

		await user.type(
			screen.getByPlaceholderText( 'Type to imagine' ),
			'  A lighthouse in a storm  '
		);
		await user.click(
			screen.getByRole( 'button', { name: 'Generate Image' } )
		);

		await waitFor( () => {
			expect( generateImage ).toHaveBeenCalledWith(
				'A lighthouse in a storm',
				{
					provider: 'auto',
					orientation: 'square',
				}
			);
		} );
		expect( onSelect ).toHaveBeenCalledWith( media );
		expect(
			screen.getByRole( 'img', { name: 'A lighthouse in a storm' } )
		).toHaveAttribute( 'src', media.url );
	} );
} );
