import { expect, test } from '@playwright/test';

const randomEmail = () => `miss+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

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

test('user starts a mission and reaches success', async ({ page }) => {
  test.setTimeout(60_000);
  await completeOnboarding(page);

  await page.getByRole('link', { name: 'Missions', exact: true }).click();
  await expect(page).toHaveURL(/\/missions$/);

  await page
    .getByRole('button', { name: /Démarrer/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/missions\/[0-9a-f-]+$/);
  await expect(page.getByText(/Objectif/i)).toBeVisible();

  await page.getByLabel('Réponse').fill('Hello, nice to meet you');
  await page.getByRole('button', { name: /Envoyer/i }).click();
  await expect(page.getByText(/tour\(s\) restant/i)).toBeVisible();

  await page.getByLabel('Réponse').fill('I think this is a success');
  await page.getByRole('button', { name: /Envoyer/i }).click();
  await expect(page.getByText(/Mission réussie/i)).toBeVisible();
});

test('/api/missions/turn requires auth', async ({ request }) => {
  const res = await request.post('/api/missions/turn', {
    data: { runId: '00000000-0000-0000-0000-000000000000', message: 'hi' },
  });
  expect(res.status()).toBe(401);
});
