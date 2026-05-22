import { expect, test } from '@playwright/test';

const randomEmail = () => `prac+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

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

test('user picks a category, practices it, then switches category', async ({ page }) => {
  test.setTimeout(60_000);
  await completeOnboarding(page);

  await page.getByRole('link', { name: /Commencer une session de pratique/i }).click();
  await expect(page).toHaveURL(/\/practice$/);

  // Category picker first — no question until a category is chosen.
  await expect(page.getByText(/Choisis ce que tu veux pratiquer/i)).toBeVisible();

  // Pick Grammar → a question loads.
  await page.getByRole('button', { name: 'Grammaire', exact: true }).click();
  await expect(page.getByRole('button', { name: 'option A' })).toBeVisible();

  // Answer it → feedback + next.
  await page.getByRole('button', { name: 'option A' }).click();
  await expect(page.getByRole('button', { name: /Question suivante/i })).toBeVisible();
  await page.getByRole('button', { name: /Question suivante/i }).click();
  await expect(page.getByRole('button', { name: 'option A' })).toBeVisible();

  // Switch category via the tab → a new question loads.
  await page.getByRole('button', { name: 'Vocabulaire', exact: true }).click();
  await expect(page.getByRole('button', { name: 'option A' })).toBeVisible();
});

test('/api/practice/next requires auth', async ({ request }) => {
  const res = await request.post('/api/practice/next');
  expect(res.status()).toBe(401);
});
