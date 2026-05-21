import { expect, test } from '@playwright/test';

const randomEmail = () => `onb+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

test('new user is routed through placement then profile then home', async ({ page }) => {
  const email = randomEmail();
  const password = 'TestPassword123!';

  // Signup
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();

  // After signup, the gate sends the user to placement.
  await expect(page).toHaveURL(/\/onboarding\/placement$/);
  await expect(page.getByText(/Situons ton niveau/i)).toBeVisible();

  // Answer all 12 placement questions (fake generator: click "option A" each time).
  for (let i = 0; i < 12; i++) {
    await expect(page.getByText(/Question \d+ \/ 12/)).toBeVisible();
    await page.getByRole('button', { name: 'option A' }).click();
  }

  // Then routed to profile.
  await expect(page).toHaveURL(/\/onboarding\/profile$/);
  await page.getByLabel(/Business/i).check();
  await page.getByRole('button', { name: /Terminer/i }).click();

  // Finally home, with estimated levels visible.
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(/Tes niveaux estimés/i)).toBeVisible();
  await expect(page.getByText(/Compréhension écrite/i)).toBeVisible();
});
