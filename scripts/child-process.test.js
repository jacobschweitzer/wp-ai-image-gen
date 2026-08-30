const assert = require( 'node:assert/strict' );
const { EventEmitter } = require( 'node:events' );
const test = require( 'node:test' );

const { waitForChild } = require( './child-process.js' );

const createChild = () => {
	const child = new EventEmitter();
	child.killed = false;
	child.killCalls = [];
	child.kill = ( signal ) => {
		child.killed = true;
		child.killCalls.push( signal );
		return true;
	};

	return child;
};

test( 'resolves with the child exit code and removes signal handlers', async () => {
	const parentProcess = new EventEmitter();
	const child = createChild();
	const completion = waitForChild( child, { parentProcess } );

	child.emit( 'exit', 7, null );

	assert.equal( await completion, 7 );
	assert.equal( parentProcess.listenerCount( 'SIGINT' ), 0 );
	assert.equal( parentProcess.listenerCount( 'SIGTERM' ), 0 );
} );

test( 'forwards SIGTERM once and waits for the child to exit', async () => {
	const parentProcess = new EventEmitter();
	const child = createChild();
	const completion = waitForChild( child, { parentProcess } );
	let completed = false;
	completion.then( () => {
		completed = true;
	} );

	parentProcess.emit( 'SIGTERM' );
	parentProcess.emit( 'SIGTERM' );
	await Promise.resolve();

	assert.deepEqual( child.killCalls, [ 'SIGTERM' ] );
	assert.equal( completed, false );

	child.emit( 'exit', null, 'SIGTERM' );

	assert.equal( await completion, 143 );
	assert.equal( parentProcess.listenerCount( 'SIGTERM' ), 0 );
} );

test( 'rejects child launch errors and removes signal handlers', async () => {
	const parentProcess = new EventEmitter();
	const child = createChild();
	const completion = waitForChild( child, { parentProcess } );

	child.emit( 'error', new Error( 'Unable to launch child' ) );

	await assert.rejects( completion, /Unable to launch child/ );
	assert.equal( parentProcess.listenerCount( 'SIGINT' ), 0 );
	assert.equal( parentProcess.listenerCount( 'SIGTERM' ), 0 );
} );
