import { defineConfig } from '@playwright/test';

import baseConfig from './playwright.config';

export default defineConfig( {
	...baseConfig,
	testDir: './premium/kaigen-premium/tests/e2e',
	testMatch: '**/*.spec.ts',
} );
