const wpConfig = require( '@wordpress/scripts/config/jest-unit.config.js' );

const { preset, reporters, ...baseConfig } = wpConfig;
void preset;
void reporters;

module.exports = {
	...baseConfig,
	testEnvironment: 'jsdom',
	modulePathIgnorePatterns: [ '<rootDir>/.stryker-tmp/' ],
	setupFiles: [],
	setupFilesAfterEnv: [],
	testMatch: [
		'<rootDir>/tests/unit/api.test.js',
		'<rootDir>/tests/unit/kaigenSettings.test.js',
	],
};
