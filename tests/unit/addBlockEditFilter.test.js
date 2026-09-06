import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiFetch from '@wordpress/api-fetch';
import { dispatch } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import AIImageToolbar from '../../src/components/AIImageToolbar';

jest.mock( '@wordpress/api-fetch' );
jest.mock( '@wordpress/block-editor', () => ( {
	BlockControls: ( { children } ) => children,
	InspectorControls: ( { children } ) => children,
} ) );
jest.mock( '@wordpress/components', () => ( {
	CheckboxControl: () => null,
	PanelBody: ( { children } ) => children,
} ) );
jest.mock( '@wordpress/data', () => ( { dispatch: jest.fn() } ) );
jest.mock( '@wordpress/hooks', () => ( { addFilter: jest.fn() } ) );
jest.mock( '../../src/components/AIImageToolbar', () => jest.fn() );
jest.mock( '../../src/utils/kaigenSettings', () => ( {
	isKaiGenAvailable: () => true,
} ) );

require( '../../src/filters/addBlockEditFilter' );

// Registration occurs once when the module loads; call histories reset per test.
const enhanceBlockEdit = addFilter.mock.calls.find(
	( [ hook, namespace ] ) =>
		hook === 'editor.BlockEdit' &&
		namespace === 'kaigen/add-regenerate-button'
)[ 2 ];
const EnhancedBlockEdit = enhanceBlockEdit( () => <div>Original block</div> );

describe( 'image block enhancement', () => {
	beforeEach( () => {
		jest.clearAllMocks();
		apiFetch.mockResolvedValue( {
			meta: { kaigen_reference_image: false },
		} );
		AIImageToolbar.mockReturnValue( null );
	} );

	it.each( [
		[ 12, 1 ],
		[ undefined, 0 ],
	] )(
		'passes the current image to the toolbar with attachment ID %p',
		async ( id, expectedRequests ) => {
			const image = {
				id,
				url: 'https://example.com/original.jpg',
				alt: 'Original lighthouse',
			};
			await act( async () => {
				render(
					<EnhancedBlockEdit
						name="core/image"
						attributes={ image }
						setAttributes={ jest.fn() }
					/>
				);
			} );
			expect(
				AIImageToolbar.mock.calls.at( -1 )[ 0 ].currentImage
			).toEqual( image );
			expect( apiFetch ).toHaveBeenCalledTimes( expectedRequests );
		}
	);

	it.each( [
		[
			{ id: 73, alt: 'Generated lighthouse' },
			{ id: 73, alt: 'Generated lighthouse' },
		],
		[ {}, { id: undefined, alt: '' } ],
	] )(
		'replaces the image once with generated media %p',
		async ( media, attributes ) => {
			const user = userEvent.setup();
			const url = 'https://example.com/generated.jpg';
			const setAttributes = jest.fn();
			const createSuccessNotice = jest.fn();
			dispatch.mockReturnValue( { createSuccessNotice } );
			AIImageToolbar.mockImplementation( ( { onImageGenerated } ) => (
				<button onClick={ () => onImageGenerated( { url, ...media } ) }>
					Replace image
				</button>
			) );
			render(
				<EnhancedBlockEdit
					name="core/image"
					attributes={ {
						id: 12,
						url: 'https://example.com/original.jpg',
					} }
					setAttributes={ setAttributes }
				/>
			);
			await user.click(
				screen.getByRole( 'button', { name: 'Replace image' } )
			);
			expect( setAttributes ).toHaveBeenCalledTimes( 1 );
			expect( setAttributes ).toHaveBeenCalledWith( {
				url,
				...attributes,
			} );
			expect( createSuccessNotice ).toHaveBeenCalledTimes( 1 );
		}
	);

	it( 'leaves other block types unchanged', () => {
		render( <EnhancedBlockEdit name="core/paragraph" attributes={ {} } /> );
		expect( screen.getByText( 'Original block' ) ).toBeVisible();
		expect( AIImageToolbar ).not.toHaveBeenCalled();
		expect( apiFetch ).not.toHaveBeenCalled();
	} );
} );
