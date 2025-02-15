/**
 * WordPress E2E test suite using Playwright.
 * Tests basic functionality of the image block and AI image generation.
 */
import { test, expect } from '@wordpress/e2e-test-utils-playwright';

/**
 * Test suite for WordPress Image Block functionality.
 */
test.describe('Image Block', () => {
    /**
     * Setup function that runs before each test to prepare the environment.
     */
    test.beforeEach(async ({ admin, page }) => {
        test.setTimeout(30000);
        
        await page.goto('/wp-admin');
        
        const currentUrl = page.url();
        if (currentUrl.includes('wp-login.php')) {
            await page.getByLabel('Username or Email Address').click();
            await page.getByLabel('Username or Email Address').fill('admin');
            await page.getByLabel('Password', { exact: true }).click();
            await page.getByLabel('Password', { exact: true }).fill('password');
            
            await Promise.all([
                page.waitForLoadState('domcontentloaded'),
                page.getByRole('button', { name: 'Log In' }).click()
            ]);
        }

        await admin.createNewPost();
    });

    /**
     * Test case for verifying image block insertion.
     */
    test('should insert image block with placeholder', async ({ editor, page }) => {
        await editor.insertBlock({ name: 'core/image' });
        
        const imageBlockSelector = '[data-type="core/image"]';
        const imageBlock = editor.canvas.locator(imageBlockSelector);
        await expect(imageBlock).toBeVisible({ timeout: 5000 });
    });

    /**
     * Test case for verifying AI image generation functionality.
     */
    test('should show AI image generation button in media placeholder', async ({ editor, page }) => {
        // Insert a new image block.
        await editor.insertBlock({ name: 'core/image' });
        
        // Wait for the image block to be visible.
        const imageBlockSelector = '[data-type="core/image"]';
        const imageBlock = editor.canvas.locator(imageBlockSelector);
        await expect(imageBlock).toBeVisible({ timeout: 5000 });

        // Look for the "Generate AI Image" button within the media placeholder.
        const aiGenerateButton = editor.canvas.getByRole('button', { 
            name: 'Generate AI Image',
            exact: true 
        });
        
        // Verify the button exists and is visible.
        await expect(aiGenerateButton).toBeVisible({ timeout: 5000 });
    });
});