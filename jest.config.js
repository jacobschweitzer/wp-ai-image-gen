const wpConfig = require( '@wordpress/scripts/config/jest-unit.config.js' );
const wpPreset = require( '@wordpress/jest-preset-default/jest-preset' );

module.exports = {
	...wpConfig,
	setupFilesAfterEnv: [
		...( wpPreset.setupFilesAfterEnv || [] ),
		'<rootDir>/tests/unit/setup-tests.js',
	],
	modulePathIgnorePatterns: [ '<rootDir>/.stryker-tmp/' ],
	collectCoverageFrom: [ 'src/**/*.js' ],
	coverageReporters: [ 'text', 'json-summary', 'lcov' ],
	coverageThreshold: {
		global: {
			statements: 33,
			branches: 22,
			functions: 25,
			lines: 33,
		},
		'./src/api.js': {
			statements: 100,
			branches: 95,
			functions: 100,
			lines: 100,
		},
		'./src/utils/kaigenSettings.js': {
			statements: 100,
			branches: 87,
			functions: 100,
			lines: 100,
		},
	},
};
