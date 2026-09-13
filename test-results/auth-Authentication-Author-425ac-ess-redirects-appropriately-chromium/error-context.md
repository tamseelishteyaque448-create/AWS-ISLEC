# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication & Authorization Runtime Verification >> AUTH-02: Anonymous /admin access redirects appropriately
- Location: tests\e2e\auth.spec.ts:27:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "next=/admin"
Received string:    "http://localhost:3000/join?mode=login&next=%2Fadmin"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "404" [level=1] [ref=e4]
    - heading "This page could not be found." [level=2] [ref=e6]
  - button "Open Next.js Dev Tools" [ref=e12] [cursor=pointer]
  - alert [ref=e16]
```

# Test source

```ts
  1   | ﻿import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Authentication & Authorization Runtime Verification', () => {
  4   |   
  5   |   test('AUTH-01: Anonymous /member access redirects to login', async ({ page }) => {
  6   |     // Navigate to protected member route while unauthenticated
  7   |     await page.goto('/member');
  8   |     
  9   |     // Wait for redirect to complete
  10  |     await page.waitForURL('**/join*');
  11  |     
  12  |     // Verify actual redirect URL
  13  |     const currentUrl = page.url();
  14  |     console.log('AUTH-01 Redirect URL:', currentUrl);
  15  |     
  16  |     // Verify redirect contains expected parameters
  17  |     expect(currentUrl).toContain('/join');
  18  |     expect(currentUrl).toContain('mode=login');
  19  |     expect(currentUrl).toContain('next=/member');
  20  |     
  21  |     // Verify login form is present
  22  |     await expect(page.locator('form')).toBeVisible();
  23  |     
  24  |     console.log('✅ AUTH-01 PASS: Anonymous /member access properly redirected');
  25  |   });
  26  | 
  27  |   test('AUTH-02: Anonymous /admin access redirects appropriately', async ({ page }) => {
  28  |     // Navigate to admin route while unauthenticated  
  29  |     await page.goto('/admin');
  30  |     
  31  |     // Wait for redirect
  32  |     await page.waitForURL('**/join*');
  33  |     
  34  |     // Verify redirect behavior
  35  |     const currentUrl = page.url();
  36  |     console.log('AUTH-02 Redirect URL:', currentUrl);
  37  |     
  38  |     expect(currentUrl).toContain('/join');
  39  |     expect(currentUrl).toContain('mode=login');
> 40  |     expect(currentUrl).toContain('next=/admin');
      |                        ^ Error: expect(received).toContain(expected) // indexOf
  41  |     
  42  |     console.log('✅ AUTH-02 PASS: Anonymous /admin access properly redirected');
  43  |   });
  44  | 
  45  |   test('AUTH-03: Anonymous /member/projects access denied', async ({ page }) => {
  46  |     // Test another protected member route
  47  |     await page.goto('/member/projects');
  48  |     
  49  |     // Wait for redirect
  50  |     await page.waitForURL('**/join*');
  51  |     
  52  |     const currentUrl = page.url();
  53  |     console.log('AUTH-03 Redirect URL:', currentUrl);
  54  |     
  55  |     expect(currentUrl).toContain('/join');
  56  |     expect(currentUrl).toContain('next=/member/projects');
  57  |     
  58  |     console.log('✅ AUTH-03 PASS: Anonymous /member/projects access denied');
  59  |   });
  60  | 
  61  |   test('AUTH-04: Login form accessibility and safety', async ({ page }) => {
  62  |     // Navigate to login form
  63  |     await page.goto('/join?mode=login');
  64  |     
  65  |     // Verify login form exists and is properly structured
  66  |     await expect(page.locator('form')).toBeVisible();
  67  |     
  68  |     // Check for email field
  69  |     const emailField = page.locator('input[type="email"], input[name*="email"]').first();
  70  |     await expect(emailField).toBeVisible();
  71  |     
  72  |     // Check for password field  
  73  |     const passwordField = page.locator('input[type="password"], input[name*="password"]').first();
  74  |     await expect(passwordField).toBeVisible();
  75  |     
  76  |     // Verify no credentials are pre-filled or exposed
  77  |     expect(await emailField.inputValue()).toBe('');
  78  |     expect(await passwordField.inputValue()).toBe('');
  79  |     
  80  |     console.log('✅ AUTH-04 PASS: Login form properly accessible and secure');
  81  |   });
  82  | 
  83  |   test('AUTH-11: Invalid credentials handling', async ({ page }) => {
  84  |     // Navigate to login
  85  |     await page.goto('/join?mode=login');
  86  |     
  87  |     // Fill invalid credentials
  88  |     await page.fill('input[type="email"], input[name*="email"]', 'invalid@nonexistent.test');
  89  |     await page.fill('input[type="password"], input[name*="password"]', 'wrongpassword');
  90  |     
  91  |     // Capture console errors to check for exposed internals
  92  |     const consoleErrors: string[] = [];
  93  |     page.on('console', (msg) => {
  94  |       if (msg.type() === 'error') {
  95  |         consoleErrors.push(msg.text());
  96  |       }
  97  |     });
  98  |     
  99  |     // Submit login form
  100 |     await page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
  101 |     
  102 |     // Wait for error handling
  103 |     await page.waitForTimeout(3000);
  104 |     
  105 |     // Verify safe error handling (should not expose database/SQL/secrets)
  106 |     const pageContent = await page.textContent('body');
  107 |     
  108 |     // Check errors don't contain sensitive info
  109 |     const unsafePatterns = [
  110 |       'sql', 'SQL', 'database', 'supabase', 'postgres', 'error:', 'stack trace',
  111 |       'auth.users', 'private.', 'service_role', 'secret', 'token'
  112 |     ];
  113 |     
  114 |     for (const pattern of unsafePatterns) {
  115 |       expect(pageContent?.toLowerCase() || '').not.toContain(pattern.toLowerCase());
  116 |     }
  117 |     
  118 |     console.log('Console errors:', consoleErrors);
  119 |     console.log('✅ AUTH-11 PASS: Invalid credentials handled safely');
  120 |   });
  121 | 
  122 |   test('AUTH-14: Next parameter redirect safety', async ({ page }) => {
  123 |     // Test with valid internal next parameter
  124 |     await page.goto('/join?mode=login&next=/member/profile');
  125 |     
  126 |     // Verify form loads properly with next parameter
  127 |     await expect(page.locator('form')).toBeVisible();
  128 |     
  129 |     const currentUrl = page.url();
  130 |     expect(currentUrl).toContain('next=/member/profile');
  131 |     
  132 |     // Test potential external redirect attack (should be blocked)
  133 |     await page.goto('/join?mode=login&next=https://evil.com');
  134 |     
  135 |     // Application should sanitize or reject external redirects
  136 |     const maliciousUrl = page.url();
  137 |     console.log('Malicious redirect test URL:', maliciousUrl);
  138 |     
  139 |     // Should not redirect to external domain
  140 |     expect(maliciousUrl).not.toContain('evil.com');
```