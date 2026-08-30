const assert = require( 'node:assert/strict' );
const test = require( 'node:test' );

const {
	assertCoverageThresholds,
	getProjectCoverage,
} = require( './php-coverage-threshold.js' );

const clover = ( { coveredMethods, coveredStatements } ) => `
<coverage>
  <project>
    <file name="example.php">
      <metrics methods="100" coveredmethods="${ coveredMethods }" statements="100" coveredstatements="${ coveredStatements }" />
    </file>
    <metrics files="1" methods="100" coveredmethods="${ coveredMethods }" statements="100" coveredstatements="${ coveredStatements }" />
  </project>
</coverage>`;

test( 'reads aggregate project coverage rather than file metrics', () => {
	assert.deepEqual(
		getProjectCoverage(
			clover( { coveredMethods: 36, coveredStatements: 67 } )
		),
		{
			lines: 67,
			methods: 36,
		}
	);
} );

test( 'accepts coverage at the configured floors', () => {
	assert.doesNotThrow( () =>
		assertCoverageThresholds(
			clover( { coveredMethods: 35, coveredStatements: 65 } ),
			{ lines: 65, methods: 35 }
		)
	);
} );

test( 'rejects line or method coverage below the configured floors', () => {
	assert.throws(
		() =>
			assertCoverageThresholds(
				clover( { coveredMethods: 34, coveredStatements: 64 } ),
				{ lines: 65, methods: 35 }
			),
		/PHP coverage is below the configured floor: lines 64.00% < 65%; methods 34.00% < 35%/
	);
} );

test( 'rejects Clover reports without aggregate metrics', () => {
	assert.throws(
		() => getProjectCoverage( '<coverage><project /></coverage>' ),
		/Aggregate project metrics are missing/
	);
} );
