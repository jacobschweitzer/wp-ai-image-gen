const PHP_COVERAGE_FLOORS = {
	lines: 65,
	methods: 35,
};

const readMetric = ( metricsTag, name ) => {
	const match = metricsTag.match( new RegExp( `\\b${ name }="(\\d+)"` ) );

	if ( ! match ) {
		throw new Error( `Clover metric ${ name } is missing.` );
	}

	return Number( match[ 1 ] );
};

const percentage = ( covered, total, label ) => {
	if ( total <= 0 ) {
		throw new Error( `Clover ${ label } total must be greater than zero.` );
	}

	return ( covered / total ) * 100;
};

const getProjectCoverage = ( cloverXml ) => {
	const projectMetrics = cloverXml.match(
		/<metrics\b(?=[^>]*\bfiles="\d+")[^>]*\/?\s*>/g
	);

	if ( ! projectMetrics || projectMetrics.length === 0 ) {
		throw new Error( 'Aggregate project metrics are missing from Clover.' );
	}

	const metrics = projectMetrics[ projectMetrics.length - 1 ];

	return {
		lines: percentage(
			readMetric( metrics, 'coveredstatements' ),
			readMetric( metrics, 'statements' ),
			'statement'
		),
		methods: percentage(
			readMetric( metrics, 'coveredmethods' ),
			readMetric( metrics, 'methods' ),
			'method'
		),
	};
};

const assertCoverageThresholds = (
	cloverXml,
	floors = PHP_COVERAGE_FLOORS
) => {
	const coverage = getProjectCoverage( cloverXml );
	const failures = Object.entries( floors )
		.filter( ( [ metric, floor ] ) => coverage[ metric ] < floor )
		.map(
			( [ metric, floor ] ) =>
				`${ metric } ${ coverage[ metric ].toFixed(
					2
				) }% < ${ floor }%`
		);

	if ( failures.length > 0 ) {
		throw new Error(
			`PHP coverage is below the configured floor: ${ failures.join(
				'; '
			) }`
		);
	}

	return coverage;
};

module.exports = {
	PHP_COVERAGE_FLOORS,
	assertCoverageThresholds,
	getProjectCoverage,
};
