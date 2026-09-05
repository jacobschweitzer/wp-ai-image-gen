import { select } from '@wordpress/data';

import {
	getCurrentImage,
	getSelectedImageBlock,
	isImageOnlyMedia,
	shouldDisplayForSelectedImageBlock,
} from '../../src/filters/mediaUtils';

jest.mock( '@wordpress/data', () => ( {
	select: jest.fn(),
} ) );

describe( 'mediaUtils', () => {
	it.each( [
		[ [], false ],
		[ [ 'video' ], false ],
		[ [ 'image' ], true ],
		[ [ 'image/jpeg', 'image/png' ], true ],
	] )(
		'recognizes image-only allowed types %#',
		( allowedTypes, expected ) => {
			expect( isImageOnlyMedia( allowedTypes ) ).toBe( expected );
		}
	);

	it( 'returns only the selected core image block', () => {
		const imageBlock = {
			name: 'core/image',
			attributes: { id: 17, url: 'https://example.com/image.jpg' },
		};
		select.mockReturnValue( { getSelectedBlock: () => imageBlock } );

		expect( getSelectedImageBlock() ).toBe( imageBlock );

		select.mockReturnValue( {
			getSelectedBlock: () => ( { name: 'core/paragraph' } ),
		} );
		expect( getSelectedImageBlock() ).toBeNull();
	} );

	it( 'normalizes current image attributes without inventing media', () => {
		expect( getCurrentImage( { attributes: {} } ) ).toBeNull();
		expect(
			getCurrentImage( {
				attributes: {
					id: 17,
					url: 'https://example.com/image.jpg',
				},
			} )
		).toEqual( {
			alt: '',
			id: 17,
			url: 'https://example.com/image.jpg',
		} );
	} );

	it( 'shows only single image pickers for the intended selected block state', () => {
		const props = { allowedTypes: [ 'image' ], multiple: false };
		const emptyImageBlock = {
			name: 'core/image',
			attributes: {},
		};
		const populatedImageBlock = {
			name: 'core/image',
			attributes: { url: 'https://example.com/image.jpg' },
		};

		expect(
			shouldDisplayForSelectedImageBlock( props, emptyImageBlock, {
				requireEmptyImage: true,
			} )
		).toBe( true );
		expect(
			shouldDisplayForSelectedImageBlock( props, populatedImageBlock, {
				requireEmptyImage: true,
			} )
		).toBe( false );
		expect(
			shouldDisplayForSelectedImageBlock(
				{ ...props, multiple: true },
				emptyImageBlock
			)
		).toBe( false );
	} );
} );
