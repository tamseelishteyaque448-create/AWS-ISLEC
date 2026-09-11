import { test, expect } from '@playwright/test';

test.describe('AWS ISLEC Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify the page responds
    expect(page.url()).toContain('/');
    
    // Verify stable public elements exist
    await expect(page).toHaveTitle(/AWS ISLEC/);
    
    // Verify main navigation exists
    await expect(page.locator('nav')).toBeVisible();
    
    // Verify no critical JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check for JavaScript errors
    expect(errors).toHaveLength(0);
    
    console.log('✅ Smoke test passed: Homepage loads without errors');
  });
});
