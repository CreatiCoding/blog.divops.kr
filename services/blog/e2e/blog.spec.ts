import { test, expect } from '@playwright/test';

test('homepage should load', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('blog.divops.kr');
});

test('should show robots.txt', async ({ page }) => {
  const response = await page.goto('/robots.txt');
  expect(response?.status()).toBe(200);
});
