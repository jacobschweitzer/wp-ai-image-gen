import { createRoot } from '@wordpress/element';
// React's act helper is supplied transitively by the WordPress element package.
// eslint-disable-next-line import/no-extraneous-dependencies
import { act } from 'react';

import {
	fetchPromptRefinements,
	fetchReferenceImages,
	generateImage,
} from '../../src/api';
import GenerateImageModal from '../../src/components/GenerateImageModal';

jest.mock( '../../src/api', () => ( {
	applyPromptRefinement: jest.fn(),
	fetchPromptRefinements: jest.fn(),
	fetchReferenceImages: jest.fn(),
	generateImage: jest.fn(),
} ) );

jest.mock( '../../src/hooks/useGenerationProgress', () => () => 0 );

jest.mock( '../../src/utils/kaigenSettings', () => ( {
	DEFAULT_REFERENCE_IMAGE_LIMIT: 5,
	getKaiGenSettings: () => ( {
		is_ai_client_available: true,
		orientation: 'square',
		provider: 'openai',
		providers: [ { id: 'openai', name: 'OpenAI' } ],
	} ),
	isKaiGenAvailable: () => true,
} ) );

jest.mock( '@wordpress/components', () => ( {
	Button: ( { children, variant: _variant, ...props } ) => (
		<button type="button" { ...props }>
			{ children }
		</button>
	),
	Dashicon: ( { icon } ) => <span data-icon={ icon } />,
	Dropdown: ( { renderContent, renderToggle } ) => (
		<>
			{ renderToggle( { isOpen: false, onToggle: jest.fn() } ) }
			{ renderContent?.( { onClose: jest.fn() } ) }
		</>
	),
	Modal: ( { children, title, ...props } ) => (
		<div role="dialog" { ...props }>
			{ title }
			{ children }
		</div>
	),
	Spinner: () => <span>Loading</span>,
	TextareaControl: ( { onChange, ...props } ) => (
		<textarea
			aria-label="Prompt"
			{ ...props }
			onChange={ ( event ) => onChange( event.target.value ) }
		/>
	),
} ) );

const deferred = () => {
	let resolve;
	let reject;
	const promise = new Promise( ( resolvePromise, rejectPromise ) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	} );

	return { promise, reject, resolve };
};

const setTextareaValue = ( textarea, value ) => {
	const valueSetter = Object.getOwnPropertyDescriptor(
		window.HTMLTextAreaElement.prototype,
		'value'
	).set;
	valueSetter.call( textarea, value );
	textarea.dispatchEvent( new Event( 'input', { bubbles: true } ) );
};

describe( 'GenerateImageModal runtime behavior', () => {
	let container;
	let root;
	let onSelect;

	beforeEach( async () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		onSelect = jest.fn();
		fetchReferenceImages.mockResolvedValue( [] );

		await act( async () => {
			root.render(
				<GenerateImageModal
					isOpen={ true }
					onClose={ jest.fn() }
					onSelect={ onSelect }
				/>
			);
		} );
	} );

	afterEach( async () => {
		await act( async () => root.unmount() );
		container.remove();
		jest.clearAllMocks();
	} );

	it( 'keeps generation single-flight across Enter and click', async () => {
		const generation = deferred();
		generateImage.mockReturnValue( generation.promise );
		const textarea = container.querySelector( 'textarea' );
		const submit = container.querySelector(
			'button[aria-label="Generate Image"]'
		);

		act( () => setTextareaValue( textarea, 'A lighthouse in a storm' ) );

		act( () => {
			textarea.dispatchEvent(
				new window.KeyboardEvent( 'keydown', {
					bubbles: true,
					key: 'Enter',
				} )
			);
			submit.click();
		} );

		expect( generateImage ).toHaveBeenCalledTimes( 1 );

		await act( async () => {
			generation.resolve( {
				id: 27,
				url: 'https://example.com/lighthouse.jpg',
			} );
			await generation.promise;
		} );

		expect( onSelect ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'retains the prompt and permits a retry after generation fails', async () => {
		generateImage
			.mockRejectedValueOnce(
				new Error( 'Provider rejected the request' )
			)
			.mockResolvedValueOnce( {
				id: 28,
				url: 'https://example.com/retry.jpg',
			} );
		const textarea = container.querySelector( 'textarea' );
		const submit = container.querySelector(
			'button[aria-label="Generate Image"]'
		);

		act( () =>
			setTextareaValue( textarea, 'A patient lighthouse keeper' )
		);

		await act( async () => submit.click() );

		expect( container.textContent ).toContain(
			'Provider rejected the request'
		);
		expect( textarea.value ).toBe( 'A patient lighthouse keeper' );
		expect( submit.disabled ).toBe( false );

		await act( async () => submit.click() );

		expect( generateImage ).toHaveBeenCalledTimes( 2 );
		expect( onSelect ).toHaveBeenCalledTimes( 1 );
		expect( onSelect ).toHaveBeenCalledWith( {
			id: 28,
			url: 'https://example.com/retry.jpg',
		} );
	} );

	it( 'does not submit blank prompts or Shift+Enter edits', async () => {
		generateImage.mockResolvedValue( {
			id: 29,
			url: 'https://example.com/keyboard.jpg',
		} );
		const textarea = container.querySelector( 'textarea' );

		act( () => {
			setTextareaValue( textarea, '   ' );
			textarea.dispatchEvent(
				new window.KeyboardEvent( 'keydown', {
					bubbles: true,
					key: 'Enter',
				} )
			);
		} );
		expect( generateImage ).not.toHaveBeenCalled();

		act( () => {
			setTextareaValue( textarea, 'A multiline prompt' );
			textarea.dispatchEvent(
				new window.KeyboardEvent( 'keydown', {
					bubbles: true,
					key: 'Enter',
					shiftKey: true,
				} )
			);
		} );
		expect( generateImage ).not.toHaveBeenCalled();

		await act( async () => {
			textarea.dispatchEvent(
				new window.KeyboardEvent( 'keydown', {
					bubbles: true,
					key: 'Enter',
				} )
			);
		} );

		expect( generateImage ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'ignores refinement results from an older prompt', async () => {
		const olderRequest = deferred();
		const newerRequest = deferred();
		fetchPromptRefinements
			.mockReturnValueOnce( olderRequest.promise )
			.mockReturnValueOnce( newerRequest.promise );
		const textarea = container.querySelector( 'textarea' );
		const interactiveMode = container.querySelector(
			'button[aria-label="Interactive mode"]'
		);

		act( () => setTextareaValue( textarea, 'An old prompt' ) );
		act( () => interactiveMode.click() );

		act( () => setTextareaValue( textarea, 'A newer prompt' ) );
		act( () => interactiveMode.click() );

		await act( async () => {
			newerRequest.resolve( [
				{
					id: 'newer-0',
					text: 'newer',
					choices: [ 'new choice' ],
				},
			] );
			await newerRequest.promise;
		} );
		expect( container.textContent ).toContain( 'newer' );

		await act( async () => {
			olderRequest.resolve( [
				{
					id: 'old-0',
					text: 'old result',
					choices: [ 'stale choice' ],
				},
			] );
			await olderRequest.promise;
		} );

		expect( container.textContent ).toContain( 'newer' );
		expect( container.textContent ).not.toContain( 'old result' );
	} );
} );
