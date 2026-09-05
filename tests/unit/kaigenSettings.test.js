import { select } from '@wordpress/data';

import {
	getKaiGenSettings,
	isKaiGenAvailable,
} from '../../src/utils/kaigenSettings';

jest.mock( '@wordpress/data', () => ( {
	select: jest.fn(),
} ) );

describe( 'isKaiGenAvailable', () => {
	const setKaiGenSettings = ( kaigenSettings ) => {
		select.mockReturnValue( {
			getEditorSettings: () => ( {
				kaigen_settings: kaigenSettings,
			} ),
		} );
	};

	beforeEach( () => {
		select.mockReset();
	} );

	it( 'returns false when the AI client exists but no image providers are available', () => {
		setKaiGenSettings( {
			is_ai_client_available: true,
			providers: [],
		} );

		expect( isKaiGenAvailable() ).toBe( false );
	} );

	it( 'returns empty settings when the editor store is unavailable', () => {
		select.mockReturnValue( undefined );

		expect( getKaiGenSettings() ).toEqual( {} );
	} );

	it( 'returns false when only automatic provider selection is present', () => {
		setKaiGenSettings( {
			is_ai_client_available: true,
			providers: [ { id: 'auto', name: 'Auto' } ],
		} );

		expect( isKaiGenAvailable() ).toBe( false );
	} );

	it( 'returns false when providers exist but the AI client is unavailable', () => {
		setKaiGenSettings( {
			is_ai_client_available: false,
			providers: [ { id: 'google', name: 'Google' } ],
		} );

		expect( isKaiGenAvailable() ).toBe( false );
	} );

	it( 'returns true when a configured provider is available', () => {
		setKaiGenSettings( {
			is_ai_client_available: true,
			providers: [
				{ id: 'auto', name: 'Auto' },
				{ id: 'google', name: 'Google' },
			],
		} );

		expect( isKaiGenAvailable() ).toBe( true );
	} );
} );
