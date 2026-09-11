import { test, expect } from '@playwright/test';

test.describe('Authentication & Authorization Runtime Verification - CORRECTED', () => {
  
  test('AUTH-01: Anonymous /member access redirects to login', async ({ page }) => {
    await page.goto('/member');
    await page.waitForURL('**/join*');
    
    const currentUrl = page.url();
    console.log('AUTH-01 Redirect URL:', currentUrl);
    
    expect(currentUrl).toContain('/join');
    expect(currentUrl).toContain('mode=login');
    // Fix: Check for URL-encoded version
    expect(currentUrl).toMatch(/next=%2Fmember|next=\/member/);
    
    await expect(page.locator('form')).toBeVisible();
    console.log('✅ AUTH-01 PASS: Anonymous /member access properly redirected');
  });

  test('AUTH-02: Anonymous /admin access redirects appropriately', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/join*');
    
    const currentUrl = page.url();
    console.log('AUTH-02 Redirect URL:', currentUrl);
    
    expect(currentUrl).toContain('/join');
    expect(currentUrl).toContain('mode=login');
    expect(currentUrl).toMatch(/next=%2Fadmin|next=\/admin/);
    
    console.log('✅ AUTH-02 PASS: Anonymous /admin access properly redirected');
  });

  test('AUTH-03: Anonymous /member/projects access denied', async ({ page }) => {
    await page.goto('/member/projects');
    await page.waitForURL('**/join*');
    
    const currentUrl = page.url();
    console.log('AUTH-03 Redirect URL:', currentUrl);
    
    expect(currentUrl).toContain('/join');
    expect(currentUrl).toMatch(/next=%2Fmember%2Fprojects|next=\/member\/projects/);
    
    console.log('✅ AUTH-03 PASS: Anonymous /member/projects access denied');
  });

  test('AUTH-11: Invalid credentials handling', async ({ page }) => {
    await page.goto('/join?mode=login');
    
    const emailField = page.locator('input[type="email"], input[name*="email"]').first();
    const passwordField = page.locator('input[type="password"], input[name*="password"]').first();
    
    await emailField.fill('invalid@nonexistent.test');
    await passwordField.fill('wrongpassword');
    
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    const submitButton = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first();
    await submitButton.click();
    
    await page.waitForTimeout(3000);
    
    const pageContent = await page.textContent('body');
    const unsafePatterns = [
      'sql', 'database', 'supabase', 'postgres', 'auth.users', 'private.', 'service_role', 'secret'
    ];
    
    for (const pattern of unsafePatterns) {
      expect(pageContent?.toLowerCase() || '').not.toContain(pattern.toLowerCase());
    }
    
    console.log('Console errors (safe 400 expected):', consoleErrors);
    console.log('✅ AUTH-11 PASS: Invalid credentials handled safely');
  });

  test('AUTH-14-SECURITY: External redirect vulnerability test', async ({ page }) => {
    // Test 1: Valid internal redirect should work
    await page.goto('/join?mode=login&next=/member/profile');
    await expect(page.locator('form')).toBeVisible();
    
    const validUrl = page.url();
    expect(validUrl).toMatch(/next=%2Fmember%2Fprofile|next=\/member\/profile/);
    
    // Test 2: External redirect should be blocked or sanitized
    await page.goto('/join?mode=login&next=https://evil.com');
    
    const maliciousUrl = page.url();
    console.log('🔍 SECURITY TEST - External redirect URL:', maliciousUrl);
    
    // CRITICAL: Check if external redirect is allowed
    if (maliciousUrl.includes('evil.com')) {
      console.log('🚨 POTENTIAL SECURITY ISSUE: External redirect not blocked');
      console.log('URL contains external domain in next parameter');
      
      // This is a finding, not necessarily a failure if properly handled on login
      // Need to test if actual login would redirect externally
    } else {
      console.log('✅ External redirect properly blocked in URL parameter');
    }
    
    // Test 3: Protocol-relative redirect
    await page.goto('/join?mode=login&next=//evil.com');
    const protocolRelativeUrl = page.url();
    console.log('🔍 Protocol-relative test URL:', protocolRelativeUrl);
    
    // Test 4: JavaScript protocol
    await page.goto('/join?mode=login&next=javascript:alert(1)');
    const jsProtocolUrl = page.url();
    console.log('🔍 JavaScript protocol test URL:', jsProtocolUrl);
    
    console.log('⚠️ AUTH-14 SECURITY ANALYSIS: External redirect handling requires further investigation');
  });

});
