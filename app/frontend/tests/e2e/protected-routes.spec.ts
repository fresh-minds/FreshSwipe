import { test, expect } from '@playwright/test';

const protectedRoutes = [
  '/',
  '/swipe',
  '/matches',
  '/profile',
  '/insights',
  '/feedback',
  '/team-trends',
  '/onboarding',
];

test.describe('protected routes', () => {
  for (const route of protectedRoutes) {
    test(`redirects unauthenticated users from ${route} to sign-in`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/api\/auth\/signin|\/login/i, { timeout: 30_000 });

      const currentUrl = page.url();
      if (currentUrl.includes('/api/auth/error')) {
        throw new Error(`Unexpected NextAuth error while redirecting from ${route}: ${currentUrl}`);
      }
    });
  }
});
