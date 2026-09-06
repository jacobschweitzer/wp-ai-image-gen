const SIGNAL_EXIT_CODES = {
	SIGINT: 130,
	SIGTERM: 143,
};

const waitForChild = ( child, { parentProcess = process } = {} ) =>
	new Promise( ( resolve, reject ) => {
		let forwardedSignal = null;
		let settled = false;
		const signalHandlers = {};

		const cleanup = () => {
			child.removeListener( 'error', handleError );
			child.removeListener( 'exit', handleExit );

			for ( const [ signal, handler ] of Object.entries(
				signalHandlers
			) ) {
				parentProcess.removeListener( signal, handler );
			}
		};

		const settle = ( callback, value ) => {
			if ( settled ) {
				return;
			}

			settled = true;
			cleanup();
			callback( value );
		};

		function handleError( error ) {
			settle( reject, error );
		}

		function handleExit( code, signal ) {
			const terminationSignal = forwardedSignal || signal;

			if ( terminationSignal ) {
				settle( resolve, SIGNAL_EXIT_CODES[ terminationSignal ] || 1 );
				return;
			}

			settle( resolve, code || 0 );
		}

		for ( const signal of Object.keys( SIGNAL_EXIT_CODES ) ) {
			signalHandlers[ signal ] = () => {
				if ( forwardedSignal ) {
					return;
				}

				forwardedSignal = signal;

				try {
					if ( ! child.killed ) {
						child.kill( signal );
					}
				} catch ( error ) {
					settle( reject, error );
				}
			};
			parentProcess.once( signal, signalHandlers[ signal ] );
		}

		child.once( 'error', handleError );
		child.once( 'exit', handleExit );
	} );

module.exports = {
	SIGNAL_EXIT_CODES,
	waitForChild,
};
