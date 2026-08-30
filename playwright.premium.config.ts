import { resolve } from 'node:path';

import baseConfig from './tests/e2e/playwright.config';
import { defineConfig } from './tests/e2e/playwright';

export default defineConfig( {
	...baseConfig,
	testDir: resolve( __dirname, 'premium/kaigen-premium/tests/e2e' ),
	testMatch: '**/*.spec.ts',
} );
