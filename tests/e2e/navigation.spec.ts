import { expect, test } from '@playwright/test';

const randomEmail = () => `nav+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

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

test('the header nav switches between modes within a session', async ({ page }) => {
  test.setTimeout(60_000);
  await completeOnboarding(page);

  // From home, jump to practice via the nav, then to the tutor, then back home.
  await page.getByRole('link', { name: 'Pratique', exact: true }).click();
  await expect(page).toHaveURL(/\/practice$/);

  await page.getByRole('link', { name: 'Tuteur', exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);

  await page.getByRole('link', { name: 'Accueil', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test('the mode nav is hidden during onboarding', async ({ page }) => {
  const email = randomEmail();
  const password = 'TestPassword123!';
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/placement$/);

  // No mode links while still onboarding.
  await expect(page.getByRole('link', { name: 'Pratique', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tuteur', exact: true })).toHaveCount(0);
});
