import { createRoot } from '@wordpress/element';
// React's act helper is supplied transitively by the WordPress element package.
// eslint-disable-next-line import/no-extraneous-dependencies
import { act } from 'react';

import apiFetch from '@wordpress/api-fetch';
import { dispatch } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';

jest.mock( '@wordpress/api-fetch' );

jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( { children } ) => children,
	InspectorControls: ( { children } ) => children,
} ) );

jest.mock( '@wordpress/components', () => ( {
	CheckboxControl: () => null,
	PanelBody: ( { children } ) => children,
} ) );

jest.mock( '@wordpress/data', () => ( {
	dispatch: jest.fn(),
} ) );

jest.mock( '@wordpress/hooks', () => ( {
	addFilter: jest.fn(),
} ) );

jest.mock(
	'../../src/components/AIImageToolbar',
	() =>
		( { onImageGenerated } ) => (
			<button
				type="button"
				onClick={ () =>
					onImageGenerated( {
						id: 73,
						url: 'https://example.com/generated.jpg',
						alt: 'Generated lighthouse',
					} )
				}
			>
				Replace image
			</button>
		)
);

jest.mock( '../../src/utils/kaigenSettings', () => ( {
	isKaiGenAvailable: () => true,
} ) );

require( '../../src/filters/addBlockEditFilter' );

describe( 'addBlockEditFilter runtime behavior', () => {
	let container;
	let root;
	let createSuccessNotice;

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		createSuccessNotice = jest.fn();
		apiFetch.mockResolvedValue( {
			meta: { kaigen_reference_image: false },
		} );
		dispatch.mockReturnValue( { createSuccessNotice } );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
		jest.clearAllMocks();
	} );

	it( 'updates the selected image block exactly once with generated media', async () => {
		const filter = addFilter.mock.calls[ 0 ][ 2 ];
		const BlockEdit = () => <div>Original image block</div>;
		const EnhancedBlockEdit = filter( BlockEdit );
		const setAttributes = jest.fn();

		await act( async () => {
			root.render(
				<EnhancedBlockEdit
					name="core/image"
					attributes={ {
						id: 12,
						url: 'https://example.com/original.jpg',
						alt: 'Original lighthouse',
					} }
					setAttributes={ setAttributes }
				/>
			);
		} );

		act( () => container.querySelector( 'button' ).click() );

		expect( setAttributes ).toHaveBeenCalledTimes( 1 );
		expect( setAttributes ).toHaveBeenCalledWith( {
			id: 73,
			url: 'https://example.com/generated.jpg',
			alt: 'Generated lighthouse',
		} );
		expect( createSuccessNotice ).toHaveBeenCalledTimes( 1 );
	} );
} );
