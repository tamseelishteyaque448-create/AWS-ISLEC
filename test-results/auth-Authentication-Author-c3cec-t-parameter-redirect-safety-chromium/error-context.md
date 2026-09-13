# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication & Authorization Runtime Verification >> AUTH-14: Next parameter redirect safety
- Location: tests\e2e\auth.spec.ts:122:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('form')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('form') with timeout 5000ms
  - waiting for locator('form')

```

```yaml
- heading "404" [level=1]
- heading "This page could not be found." [level=2]
- alert
```

# Test source

```ts
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
  40  |     expect(currentUrl).toContain('next=/admin');
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
> 127 |     await expect(page.locator('form')).toBeVisible();
      |                                        ^ Error: expect(locator).toBeVisible() failed
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
  141 |     
  142 |     console.log('✅ AUTH-14 PASS: Next parameter redirect safety verified');
  143 |   });
  144 | 
  145 |   test('AUTH-INVITE: Invite flow accessibility check', async ({ page }) => {
  146 |     // Test direct access to invite route without valid session
  147 |     await page.goto('/auth/invite');
  148 |     
  149 |     // Should handle invalid/missing invite gracefully
  150 |     await page.waitForLoadState('networkidle');
  151 |     
  152 |     const currentUrl = page.url();
  153 |     console.log('Direct invite access URL:', currentUrl);
  154 |     
  155 |     // Should not crash or expose internals
  156 |     const pageContent = await page.textContent('body');
  157 |     expect(pageContent).toBeDefined();
  158 |     
  159 |     console.log('⚠️ AUTH-INVITE PARTIAL: Direct invite access handled (full flow requires valid invite)');
  160 |   });
  161 | 
  162 | });
  163 | 
```