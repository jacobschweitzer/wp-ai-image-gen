import { createRoot, useEffect } from '@wordpress/element';
// React's act helper is supplied transitively by the WordPress element package.
// eslint-disable-next-line import/no-extraneous-dependencies
import { act as reactAct } from 'react';

import useGenerationProgress from '../../src/hooks/useGenerationProgress';

const ProgressHarness = ( { isActive, onProgress } ) => {
	const progress = useGenerationProgress( isActive );

	useEffect( () => {
		onProgress( progress );
	}, [ onProgress, progress ] );

	return null;
};

describe( 'useGenerationProgress', () => {
	let container;
	let root;
	let progressValues;
	let now;

	beforeAll( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	afterAll( () => {
		delete global.IS_REACT_ACT_ENVIRONMENT;
	} );

	beforeEach( () => {
		jest.useFakeTimers();
		now = 1000;
		jest.spyOn( Date, 'now' ).mockImplementation( () => now );
		container = document.createElement( 'div' );
		root = createRoot( container );
		progressValues = [];
	} );

	afterEach( () => {
		reactAct( () => root.unmount() );
		Date.now.mockRestore();
		jest.useRealTimers();
	} );

	const render = ( isActive ) => {
		reactAct( () => {
			root.render(
				<ProgressHarness
					isActive={ isActive }
					onProgress={ ( progress ) =>
						progressValues.push( progress )
					}
				/>
			);
		} );
	};

	it( 'advances monotonically and caps at 99', () => {
		render( true );

		now = 16000;
		reactAct( () => jest.advanceTimersByTime( 200 ) );
		expect( progressValues.at( -1 ) ).toBe( 50 );

		now = 11000;
		reactAct( () => jest.advanceTimersByTime( 200 ) );
		expect( progressValues.at( -1 ) ).toBe( 50 );

		now = 61000;
		reactAct( () => jest.advanceTimersByTime( 200 ) );
		expect( progressValues.at( -1 ) ).toBe( 99 );
	} );

	it( 'resets when inactive and cleans its interval', () => {
		const clearIntervalSpy = jest.spyOn( global, 'clearInterval' );
		render( true );
		now = 16000;
		reactAct( () => jest.advanceTimersByTime( 200 ) );

		render( false );

		expect( progressValues.at( -1 ) ).toBe( 0 );
		expect( clearIntervalSpy ).toHaveBeenCalled();
		expect( jest.getTimerCount() ).toBe( 0 );
		clearIntervalSpy.mockRestore();
	} );
} );
