import { test, expect } from '@playwright/test';

test('admin page should redirect to signin when not authenticated', async ({
  page,
}) => {
  await page.goto('/admin/posts');
  await expect(page).toHaveURL(/\/api\/auth\/signin/);
});
