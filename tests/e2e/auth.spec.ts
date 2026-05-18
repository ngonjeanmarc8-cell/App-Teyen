import { expect, test } from '@playwright/test';

const randomEmail = () => `test+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

test('user can sign up, see home, log out and log back in', async ({ page }) => {
  const email = randomEmail();
  const password = 'TestPassword123!';

  // Signup
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(email).first()).toBeVisible();

  // Logout
  await page.getByRole('button', { name: /Se déconnecter/i }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Login
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /^Se connecter$/i }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test('signup rejects short password', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Email').fill('shortpw@teyen.test');
  await page.getByLabel('Mot de passe').fill('short');
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page.getByRole('alert').first()).toContainText(/8 caractères/);
});

test('login rejects bad credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('does-not-exist@teyen.test');
  await page.getByLabel('Mot de passe').fill('whatever123');
  await page.getByRole('button', { name: /^Se connecter$/i }).click();
  await expect(page.getByRole('alert').first()).toContainText(/invalides/);
});

test('/home redirects to /login when not authenticated', async ({ page }) => {
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login$/);
});

test('/api/me returns user when authed, 401 when not', async ({ page, request }) => {
  // Unauthed
  const unauthed = await request.get('/api/me');
  expect(unauthed.status()).toBe(401);

  // Sign up to get a session
  const email = `me+${Date.now()}@teyen.test`;
  const password = 'TestPassword123!';
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/home$/);

  // Now /api/me should return the user
  const authed = await page.request.get('/api/me');
  expect(authed.status()).toBe(200);
  const json = await authed.json();
  expect(json.email).toBe(email);
});
