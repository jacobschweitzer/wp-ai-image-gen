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
		'src/utils/promptRefinement.js',
	],
	coverageReporters: [ 'text', 'json-summary', 'lcov' ],
	coverageThreshold: {
		global: {
			statements: 33,
			branches: 22,
			functions: 25,
			lines: 33,
		},
		'src/api.js': {
			branches: 70,
			functions: 75,
			lines: 77,
			statements: 77,
		},
		'src/components/GenerateImageModal.js': {
			branches: 35,
			functions: 40,
			lines: 52,
			statements: 53,
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
			branches: 87,
			functions: 100,
			lines: 100,
			statements: 100,
		},
		'src/utils/promptRefinement.js': {
			branches: 61,
			functions: 100,
			lines: 82,
			statements: 83,
		},
	},
	testPathIgnorePatterns: [
		...( wordpressScriptsConfig.testPathIgnorePatterns || [] ),
		'<rootDir>/.worktrees/',
		'<rootDir>/premium/',
	],
};
