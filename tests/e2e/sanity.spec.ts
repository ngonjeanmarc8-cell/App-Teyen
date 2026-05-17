import { expect, test } from '@playwright/test';

test('home page responds 200', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
});
