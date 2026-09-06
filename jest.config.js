const wordpressScriptsConfig = require( '@wordpress/scripts/config/jest-unit.config' );
const wpPreset = require( '@wordpress/jest-preset-default/jest-preset' );

module.exports = {
	...wordpressScriptsConfig,
	roots: [ '<rootDir>/tests/unit' ],
	setupFilesAfterEnv: [
		...( wpPreset.setupFilesAfterEnv || [] ),
		'<rootDir>/tests/unit/setup-tests.js',
	],
	modulePathIgnorePatterns: [ '<rootDir>/.stryker-tmp/' ],
	collectCoverageFrom: [
		'src/api.js',
		'src/components/GenerateImageModal.js',
		'src/filters/mediaUtils.js',
		'src/hooks/useGenerationProgress.js',
		'src/utils/kaigenSettings.js',
	],
	coverageReporters: [ 'text', 'json-summary', 'lcov' ],
	coverageThreshold: {
		'src/api.js': {
			branches: 100,
			functions: 100,
			lines: 100,
			statements: 100,
		},
		'src/components/GenerateImageModal.js': {
			branches: 80,
			functions: 90,
			lines: 90,
			statements: 90,
		},
		'src/filters/mediaUtils.js': {
			branches: 94,
			functions: 100,
			lines: 100,
			statements: 100,
		},
		'src/hooks/useGenerationProgress.js': {
			branches: 75,
			functions: 100,
			lines: 100,
			statements: 100,
		},
		'src/utils/kaigenSettings.js': {
			branches: 100,
			functions: 100,
			lines: 100,
			statements: 100,
		},
	},
	testPathIgnorePatterns: [
		...( wordpressScriptsConfig.testPathIgnorePatterns || [] ),
		'<rootDir>/.worktrees/',
	],
};
