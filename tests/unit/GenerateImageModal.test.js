import { act, render, screen, waitFor } from '@testing-library/react';
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

	it( 'keeps generation single-flight across Enter and click', async () => {
		const user = userEvent.setup();
		let resolve;
		generateImage.mockReturnValue(
			new Promise( ( done ) => {
				resolve = done;
			} )
		);
		const onSelect = jest.fn();
		render(
			<GenerateImageModal
				isOpen
				onClose={ jest.fn() }
				onSelect={ onSelect }
			/>
		);
		await user.type(
			screen.getByPlaceholderText( 'Type to imagine' ),
			'Lighthouse{Enter}'
		);
		await user.click(
			screen.getByRole( 'button', { name: 'Generate Image' } )
		);
		expect( generateImage ).toHaveBeenCalledTimes( 1 );
		await act( async () =>
			resolve( { id: 27, url: 'https://example.com/result.jpg' } )
		);
		expect( onSelect ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'preserves the prompt after failure and allows a successful retry', async () => {
		const user = userEvent.setup();
		const media = { id: 28, url: 'https://example.com/retry.jpg' };
		generateImage
			.mockRejectedValueOnce( new Error( 'Provider unavailable' ) )
			.mockResolvedValueOnce( media );
		const onSelect = jest.fn();
		render(
			<GenerateImageModal
				isOpen
				onClose={ jest.fn() }
				onSelect={ onSelect }
			/>
		);
		const prompt = screen.getByPlaceholderText( 'Type to imagine' );
		await user.type( prompt, 'A patient lighthouse keeper' );
		await user.click(
			screen.getByRole( 'button', { name: 'Generate Image' } )
		);
		expect(
			await screen.findByText( 'Provider unavailable' )
		).toBeVisible();
		expect( prompt ).toHaveValue( 'A patient lighthouse keeper' );
		expect( onSelect ).not.toHaveBeenCalled();
		await user.click(
			screen.getByRole( 'button', { name: 'Generate Image' } )
		);
		await waitFor( () => expect( onSelect ).toHaveBeenCalledWith( media ) );
		expect( generateImage ).toHaveBeenCalledTimes( 2 );
	} );

	it( 'does not submit blank prompts or Shift+Enter edits', async () => {
		const user = userEvent.setup();
		generateImage.mockResolvedValue( {
			id: 29,
			url: 'https://example.com/result.jpg',
		} );
		render(
			<GenerateImageModal
				isOpen
				onClose={ jest.fn() }
				onSelect={ jest.fn() }
			/>
		);
		const prompt = screen.getByPlaceholderText( 'Type to imagine' );
		await user.type( prompt, '   {Enter}' );
		expect( generateImage ).not.toHaveBeenCalled();
		await user.clear( prompt );
		await user.type( prompt, 'A multiline{Shift>}{Enter}{/Shift}prompt' );
		expect( generateImage ).not.toHaveBeenCalled();
		await user.keyboard( '{Enter}' );
		expect( generateImage ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'previews URL-only initial images without submitting them as references', async () => {
		const user = userEvent.setup();
		generateImage.mockResolvedValue( {
			id: 30,
			url: 'https://example.com/result.jpg',
		} );
		render(
			<GenerateImageModal
				isOpen
				onClose={ jest.fn() }
				onSelect={ jest.fn() }
				initialReferenceImage={ {
					url: 'https://example.com/external.jpg',
					alt: 'External image',
				} }
			/>
		);
		expect(
			screen.getByRole( 'img', { name: 'External image' } )
		).toHaveAttribute( 'src', 'https://example.com/external.jpg' );
		await user.click(
			screen.getByRole( 'button', { name: 'Reference Images' } )
		);
		expect(
			screen.queryByRole( 'menuitemcheckbox' )
		).not.toBeInTheDocument();
		await user.type(
			screen.getByPlaceholderText( 'Type to imagine' ),
			'Update image{Enter}'
		);
		expect( generateImage ).toHaveBeenCalledWith( 'Update image', {
			provider: 'auto',
			orientation: 'square',
		} );
	} );

	it( 'keeps the dialog open and uses generated media as the next reference', async () => {
		const user = userEvent.setup();
		const onClose = jest.fn();
		generateImage.mockResolvedValue( {
			id: 42,
			url: 'https://example.com/result.jpg',
			alt: 'Generated image',
		} );
		render(
			<GenerateImageModal
				isOpen
				onClose={ onClose }
				onSelect={ jest.fn() }
			/>
		);
		await user.type(
			screen.getByPlaceholderText( 'Type to imagine' ),
			'Lighthouse{Enter}'
		);
		expect(
			await screen.findByRole( 'img', { name: 'Generated image' } )
		).toBeVisible();
		expect( screen.getByRole( 'dialog' ) ).toBeVisible();
		expect( onClose ).not.toHaveBeenCalled();
		await user.click(
			screen.getByRole( 'button', { name: 'Generate Image' } )
		);
		expect( generateImage ).toHaveBeenLastCalledWith( 'Lighthouse', {
			provider: 'auto',
			orientation: 'square',
			sourceImageIds: [ 42 ],
		} );
	} );

	it( 'deduplicates references by ID and enforces the selected provider limit', async () => {
		const user = userEvent.setup();
		const initial = {
			id: 10,
			url: 'https://example.com/first.jpg',
			alt: 'First',
		};
		fetchReferenceImages.mockResolvedValue( [
			{ ...initial, id: '10', alt: 'Duplicate' },
			{ id: 11, url: 'https://example.com/second.jpg', alt: 'Second' },
		] );
		getKaiGenSettings.mockReturnValue( {
			provider: 'auto',
			orientation: 'square',
			providers: [
				{ id: 'auto', name: 'Auto', referenceImageLimit: 5 },
				{ id: 'openai', name: 'OpenAI', referenceImageLimit: 5 },
				{ id: 'google', name: 'Google', referenceImageLimit: 1 },
			],
		} );
		generateImage.mockResolvedValue( {
			id: 42,
			url: 'https://example.com/result.jpg',
		} );
		render(
			<GenerateImageModal
				isOpen
				onClose={ jest.fn() }
				onSelect={ jest.fn() }
				initialReferenceImage={ initial }
			/>
		);
		await user.click(
			screen.getByRole( 'button', { name: 'Reference Images' } )
		);
		expect( screen.getAllByRole( 'menuitemcheckbox' ) ).toHaveLength( 2 );
		expect(
			screen.getByRole( 'menuitemcheckbox', { name: 'First' } )
		).toHaveAttribute( 'aria-checked', 'true' );
		await user.click(
			screen.getByRole( 'menuitemcheckbox', { name: 'Second' } )
		);
		expect(
			screen.getByRole( 'menuitemcheckbox', { name: 'Second' } )
		).toHaveAttribute( 'aria-checked', 'true' );
		await user.click(
			screen.getByRole( 'button', { name: 'Provider: Auto' } )
		);
		await user.click(
			screen.getByRole( 'menuitemradio', { name: 'Google' } )
		);
		expect(
			screen.getByRole( 'button', { name: 'Provider: Google' } )
		).toBeVisible();
		expect(
			screen.getByRole( 'menuitemcheckbox', { name: 'Second' } )
		).toHaveAttribute( 'aria-checked', 'false' );
		await user.click(
			screen.getByRole( 'menuitemcheckbox', { name: 'Second' } )
		);
		expect(
			screen.getByRole( 'menuitemcheckbox', { name: 'Second' } )
		).toHaveAttribute( 'aria-checked', 'false' );
		await user.click(
			screen.getByRole( 'button', { name: 'Aspect ratio: 1:1 Square' } )
		);
		await user.click(
			screen.getByRole( 'menuitemradio', { name: '9:16 Vertical' } )
		);
		await user.type(
			screen.getByPlaceholderText( 'Type to imagine' ),
			'Update{Enter}'
		);
		expect( generateImage ).toHaveBeenCalledWith( 'Update', {
			provider: 'google',
			orientation: 'portrait',
			sourceImageIds: [ 10 ],
		} );
	} );

	it( 'hides provider selection with only one real provider', async () => {
		await act( async () => {
			render(
				<GenerateImageModal
					isOpen
					onClose={ jest.fn() }
					onSelect={ jest.fn() }
				/>
			);
		} );
		expect(
			screen.queryByRole( 'button', { name: /^Provider:/ } )
		).not.toBeInTheDocument();
	} );
} );
