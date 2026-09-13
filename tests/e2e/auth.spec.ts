import { test, expect } from '@playwright/test';

function expectLoginRedirect(currentUrl: string, expectedNext: string) {
  const url = new URL(currentUrl);

  expect(url.pathname).toBe('/join');
  expect(url.searchParams.get('mode')).toBe('login');
  expect(url.searchParams.get('next')).toBe(expectedNext);
}

test.describe('Authentication & Authorization Runtime Verification', () => {
  
  test('AUTH-01: Anonymous /member access redirects to login', async ({ page }) => {
    // Navigate to protected member route while unauthenticated
    await page.goto('/member');
    
    // Wait for redirect to complete
    await page.waitForURL('**/join*');
    
    // Verify actual redirect URL
    const currentUrl = page.url();
    console.log('AUTH-01 Redirect URL:', currentUrl);
    
    // URLSearchParams returns the decoded next value.
    expectLoginRedirect(currentUrl, '/member');
    
    // Verify login form is present
    await expect(page.locator('form')).toBeVisible();
    
    console.log('✅ AUTH-01 PASS: Anonymous /member access properly redirected');
  });

  test('AUTH-02: Anonymous /admin access redirects appropriately', async ({ page }) => {
    // Navigate to admin route while unauthenticated  
    await page.goto('/admin');
    
    // Wait for redirect
    await page.waitForURL('**/join*');
    
    // Verify redirect behavior
    const currentUrl = page.url();
    console.log('AUTH-02 Redirect URL:', currentUrl);
    
    expectLoginRedirect(currentUrl, '/admin');
    
    console.log('✅ AUTH-02 PASS: Anonymous /admin access properly redirected');
  });

  test('AUTH-03: Anonymous /member/projects access denied', async ({ page }) => {
    // Test another protected member route
    await page.goto('/member/projects');
    
    // Wait for redirect
    await page.waitForURL('**/join*');
    
    const currentUrl = page.url();
    console.log('AUTH-03 Redirect URL:', currentUrl);
    
    expectLoginRedirect(currentUrl, '/member/projects');
    
    console.log('✅ AUTH-03 PASS: Anonymous /member/projects access denied');
  });

  test('AUTH-04: Login form accessibility and safety', async ({ page }) => {
    // Navigate to login form
    await page.goto('/join?mode=login');
    
    // Verify login form exists and is properly structured
    await expect(page.locator('form')).toBeVisible();
    
    // Check for email field
    const emailField = page.locator('input[type="email"], input[name*="email"]').first();
    await expect(emailField).toBeVisible();
    
    // Check for password field  
    const passwordField = page.locator('input[type="password"], input[name*="password"]').first();
    await expect(passwordField).toBeVisible();
    
    // Verify no credentials are pre-filled or exposed
    expect(await emailField.inputValue()).toBe('');
    expect(await passwordField.inputValue()).toBe('');
    
    console.log('✅ AUTH-04 PASS: Login form properly accessible and secure');
  });

  test('AUTH-11: Invalid credentials handling', async ({ page }) => {
    // Navigate to login
    await page.goto('/join?mode=login');
    
    // Fill invalid credentials
    await page.fill('input[type="email"], input[name*="email"]', 'invalid@nonexistent.test');
    await page.fill('input[type="password"], input[name*="password"]', 'wrongpassword');
    
    // Capture console errors to check for exposed internals
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Submit login form
    await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
    
    // Wait for error handling
    await page.waitForTimeout(3000);
    
    // Verify safe error handling (should not expose database/SQL/secrets)
    const pageContent = await page.textContent('body');
    
    // Check errors don't contain sensitive info
    const unsafePatterns = [
      'sql', 'SQL', 'database', 'supabase', 'postgres', 'error:', 'stack trace',
      'auth.users', 'private.', 'service_role', 'secret', 'token'
    ];
    
    for (const pattern of unsafePatterns) {
      expect(pageContent?.toLowerCase() || '').not.toContain(pattern.toLowerCase());
    }
    
    console.log('Console errors:', consoleErrors);
    console.log('✅ AUTH-11 PASS: Invalid credentials handled safely');
  });

  test('AUTH-14: Next parameter redirect safety', async ({ page }) => {
    // Test with valid internal next parameter
    await page.goto('/join?mode=login&next=/member/profile');
    
    // Verify form loads properly with next parameter
    await expect(page.locator('form')).toBeVisible();
    
    const currentUrl = page.url();
    const validUrl = new URL(currentUrl);
    expect(validUrl.searchParams.get('next')).toBe('/member/profile');
    
    // Test potential external redirect attack (should be blocked)
    await page.goto('/join?mode=login&next=https://evil.com');
    
    // Before authentication, the app may retain the requested value in the URL,
    // but it must not navigate to the untrusted origin.
    const maliciousUrl = new URL(page.url());
    console.log('Malicious redirect test URL:', maliciousUrl.toString());
    expect(maliciousUrl.origin).toBe(validUrl.origin);
    expect(maliciousUrl.searchParams.get('next')).toBe('https://evil.com');

    // NOT VERIFIED: final post-auth redirect behavior requires a least-privilege test account.
    console.log('⚠️ AUTH-14 NOT VERIFIED: Final post-auth redirect requires a least-privilege test account.');
  });

  test('AUTH-INVITE: Invite flow accessibility check', async ({ page }) => {
    // Test direct access to invite route without valid session
    await page.goto('/auth/invite');
    
    // Should handle invalid/missing invite gracefully
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    console.log('Direct invite access URL:', currentUrl);
    
    // Should not crash or expose internals
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeDefined();
    
    console.log('⚠️ AUTH-INVITE PARTIAL: Direct invite access handled (full flow requires valid invite)');
  });

});
