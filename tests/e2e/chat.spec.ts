import { expect, test } from '@playwright/test';

const randomEmail = () => `chat+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

async function completeOnboarding(page: import('@playwright/test').Page) {
  const email = randomEmail();
  const password = 'TestPassword123!';
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/placement$/);
  for (let i = 0; i < 12; i++) {
    await expect(page.getByText(/Question \d+ \/ 12/)).toBeVisible();
    await page.getByRole('button', { name: 'option A' }).click();
  }
  await expect(page).toHaveURL(/\/onboarding\/profile$/);
  await page.getByLabel(/Business/i).check();
  await page.getByRole('button', { name: /Terminer/i }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('an onboarded user can chat with the tutor and gets a reply', async ({ page }) => {
  test.setTimeout(60_000);
  await completeOnboarding(page);

  await page.getByRole('link', { name: /Discuter avec le tuteur/i }).click();
  await expect(page).toHaveURL(/\/chat$/);

  await page.getByLabel('Message').fill('Hello, can you help me?');
  await page.getByRole('button', { name: /Envoyer/i }).click();

  await expect(page.getByText('Hello, can you help me?')).toBeVisible();
  await expect(page.getByText(/Let's work on/i)).toBeVisible({ timeout: 20_000 });
});

test('/api/chat requires auth', async ({ request }) => {
  const res = await request.post('/api/chat', { data: { message: 'hi' } });
  expect(res.status()).toBe(401);
});

test('chat history persists across reloads', async ({ page }) => {
  test.setTimeout(60_000);
  await completeOnboarding(page);
  await page.goto('/chat');
  await page.getByLabel('Message').fill('Remember this message');
  await page.getByRole('button', { name: /Envoyer/i }).click();
  await expect(page.getByText(/Let's work on/i)).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByText('Remember this message')).toBeVisible();
});
