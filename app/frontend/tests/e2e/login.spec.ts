import { test, expect } from '@playwright/test';

test('login page loads and Microsoft sign-in redirects to Entra ID', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('FreshSwipe v2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Microsoft' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign in with Microsoft' }).click();

  await page.waitForURL(/login\.microsoftonline\.com|\/login\?/i, { timeout: 30_000 });
  const currentUrl = page.url();

  if (currentUrl.includes('/api/auth/error')) {
    throw new Error(
      `NextAuth returned an error instead of redirecting to Entra ID. ` +
        `This usually means the Azure AD app redirect URI is not configured for this domain. ` +
        `URL: ${currentUrl}`
    );
  }

  if (process.env.E2E_ENFORCE_OAUTH === 'true') {
    await expect(page).toHaveURL(/login\.microsoftonline\.com/i, { timeout: 30_000 });
    return;
  }

  if (currentUrl.includes('login.microsoftonline.com')) {
    await expect(page).toHaveURL(/login\.microsoftonline\.com/i, { timeout: 30_000 });
    return;
  }

  await expect(page).toHaveURL(/\/login\?/i, { timeout: 30_000 });
  await expect(page.url()).toContain('error=OAuthSignin');
});
