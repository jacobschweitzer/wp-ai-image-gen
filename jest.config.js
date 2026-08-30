const wordpressScriptsConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...wordpressScriptsConfig,
	roots: [ '<rootDir>/tests/unit' ],
	collectCoverageFrom: [
		'src/api.js',
		'src/components/GenerateImageModal.js',
		'src/filters/mediaUtils.js',
		'src/hooks/useGenerationProgress.js',
		'src/utils/promptRefinement.js',
	],
	coverageThreshold: {
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
