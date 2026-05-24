import { expect, test } from '@playwright/test';

const randomEmail = () =>
  `audio+${Date.now()}+${Math.random().toString(36).slice(2, 8)}@teyen.test`;

async function signupOnly(page: import('@playwright/test').Page) {
  const email = randomEmail();
  const password = 'TestPassword123!';
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: /Créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/placement$/);
}

test('/api/tts returns audio bytes for an authenticated user (fake)', async ({ page }) => {
  await signupOnly(page);
  const res = await page.request.post('/api/tts', { data: { text: 'Hello there' } });
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('audio/mpeg');
  const body = await res.body();
  expect(body.length).toBeGreaterThan(0);
});

test('/api/transcribe returns text for an authenticated user (fake)', async ({ page }) => {
  await signupOnly(page);
  const res = await page.request.post('/api/transcribe', {
    multipart: {
      audio: { name: 'speech.webm', mimeType: 'audio/webm', buffer: Buffer.from([0, 1, 2, 3]) },
    },
  });
  expect(res.status()).toBe(200);
  const json = (await res.json()) as { text: string };
  expect(json.text.length).toBeGreaterThan(0);
});

test('/api/tts requires auth', async ({ request }) => {
  const res = await request.post('/api/tts', { data: { text: 'hi' } });
  expect(res.status()).toBe(401);
});

test('/api/transcribe requires auth', async ({ request }) => {
  const res = await request.post('/api/transcribe', {
    multipart: { audio: { name: 'speech.webm', mimeType: 'audio/webm', buffer: Buffer.from([0]) } },
  });
  expect(res.status()).toBe(401);
});
