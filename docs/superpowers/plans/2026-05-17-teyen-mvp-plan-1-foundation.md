# Teyen MVP — Plan 1 : Fondations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le socle technique de Teyen : projet Next.js initialisé, schéma DB complet, authentification Supabase fonctionnelle, page d'accueil derrière login, tests unitaires/E2E en place, CI et déploiement Vercel.

**Architecture:** Next.js 15 App Router en monorepo simple. Backend = Next.js Route Handlers + Server Actions. Persistance Postgres via Supabase (DB + Auth managés). Drizzle ORM pour les schémas TypeScript et migrations. Trois "cerveaux" (chat, engine, generator) viendront dans les plans suivants ; ce plan ne pose que la couche socle (modules `auth` et tables vides).

**Tech Stack:**
- Next.js 15 (App Router) + TypeScript strict
- Supabase (Postgres + Auth) — projet "dev" et un projet "test" séparé
- Drizzle ORM + drizzle-kit pour migrations
- OpenAI SDK (`openai`) — installé mais pas encore utilisé
- Vitest pour tests unitaires
- Playwright pour tests E2E
- Biome pour lint + format
- pnpm comme package manager
- Vercel pour déploiement
- GitHub Actions pour CI

---

## Prérequis humains avant de commencer

Ces actions sont à faire **par l'utilisateur**, en une fois, avant de lancer le plan :

1. **Node.js ≥ 20** installé (`node -v` pour vérifier).
2. **pnpm** installé : `npm install -g pnpm` (ou via Corepack : `corepack enable`).
3. **Compte Supabase** créé sur https://supabase.com.
4. **Compte Vercel** créé sur https://vercel.com et lié à GitHub.
5. **Compte OpenAI** avec clé API (pas encore utilisée mais on la stocke).
6. **Repo GitHub vide** créé (nom suggéré : `teyen`) où on poussera le code à la fin.

On va créer deux **projets Supabase** distincts pour ce plan :
- `teyen-dev` : utilisé en local et sur les previews Vercel.
- `teyen-test` : utilisé par Playwright en CI et en local pour les tests E2E.

L'instruction de création des projets Supabase est dans la Task 9.

---

## Vue d'ensemble du plan

| # | Phase | Tasks |
|---|-------|-------|
| 0 | Setup outillage | 1–8 |
| 1 | Base de données | 9–14 |
| 2 | Auth & pages | 15–22 |
| 3 | API & santé | 23–24 |
| 4 | CI & déploiement | 25–27 |

Total : **27 tâches**. Compter 1–3 jours de travail réparti pour un dev débutant, à raison de petits blocs.

---

## Phase 0 — Setup et outillage

### Task 1: Préparer le repo pour Next.js

**Files:**
- Modify: `.gitignore` (sera remplacé puis re-mergé)

L'init de Next.js va écrire dans le dossier courant. On préserve notre `.gitignore` actuel le temps de l'install.

- [ ] **Step 1: Sauvegarder l'existant**

```bash
cd /Users/jeanmarcngon/Documents/Teyen
mv .gitignore .gitignore.bak
ls -la
```

Expected output : `.gitignore.bak`, `.git/`, `docs/` présents.

- [ ] **Step 2: Commit l'état actuel pour avoir un point de reprise**

```bash
git status
```

Expected : working tree clean (le `mv` ne change que le nom du fichier, qui n'est pas tracké car… si, il l'est. On va devoir committer ce renommage.) En cas de doute :

```bash
git add -A
git commit -m "chore: rename .gitignore to .gitignore.bak before scaffold"
```

---

### Task 2: Scaffold Next.js dans le répertoire courant

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `.gitignore`, `eslint.config.mjs`, `postcss.config.mjs`, `public/`, etc. (par create-next-app)

- [ ] **Step 1: Lancer create-next-app sur le dossier courant**

```bash
pnpm dlx create-next-app@latest . --typescript --app --tailwind --src-dir --import-alias "@/*" --no-eslint --use-pnpm
```

Quand il demande "directory not empty, continue?" → répondre **Yes**.

Expected : le projet est scaffoldé en place. Présence de `src/app/`, `package.json`, `tsconfig.json`, etc.

Note : on a passé `--no-eslint` parce qu'on utilise Biome à la place.

- [ ] **Step 2: Re-merger notre .gitignore**

Comparer le `.gitignore` créé par Next.js et le nôtre :

```bash
cat .gitignore.bak
echo "---"
cat .gitignore
```

Append les lignes manquantes de `.gitignore.bak` dans `.gitignore` si besoin (en pratique, celui de Next.js est complet ; ajouter juste `.idea/`, `*.swp`, `*.log` à la fin si absentes).

Puis supprimer le backup :

```bash
rm .gitignore.bak
```

- [ ] **Step 3: Vérifier que le dev server tourne**

```bash
pnpm dev
```

Expected : ouvre `http://localhost:3000` qui affiche la page Next.js par défaut. `Ctrl+C` pour arrêter.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 app router with tailwind and src dir"
```

---

### Task 3: Activer le mode TypeScript strict

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Ouvrir tsconfig.json et durcir la config**

Remplacer le contenu entier de `tsconfig.json` par cette version. On préserve les `include` et `plugins` générés par Next 16, on ajoute les flags stricts manquants, on remet `target: ES2022`, `allowJs: false`, et on garde `jsx: "react-jsx"` (valeur Next 16) :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

> Note : `strict: true` implique déjà `noImplicitAny` et `strictNullChecks`, donc on ne les répète pas. On ajoute explicitement les trois flags qui ne sont pas dans `strict` : `noUncheckedIndexedAccess`, `noImplicitOverride`, `forceConsistentCasingInFileNames`.

- [ ] **Step 2: Vérifier que la compilation passe encore**

```bash
pnpm exec tsc --noEmit
```

Expected : aucune erreur. Si une page générée par Next.js casse à cause de `noUncheckedIndexedAccess`, c'est OK — fixer au fil de l'eau.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: enable strict typescript with noUncheckedIndexedAccess"
```

---

### Task 4: Installer et configurer Biome (lint + format)

**Files:**
- Create: `biome.json`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Installer Biome**

```bash
pnpm add -D --save-exact @biomejs/biome
```

Expected : `@biomejs/biome` apparaît dans `devDependencies` de `package.json`.

- [ ] **Step 2: Créer biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": false },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "noNonNullAssertion": "warn" },
      "suspicious": { "noExplicitAny": "warn" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" } },
  "json": { "formatter": { "trailingCommas": "none" } }
}
```

- [ ] **Step 3: Ajouter les scripts dans package.json**

Dans `package.json`, dans `"scripts"`, ajouter :

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit"
  }
}
```

(Conserver les scripts existants `dev`, `build`, `start`.)

- [ ] **Step 4: Formater une première fois et vérifier**

```bash
pnpm lint:fix
pnpm lint
```

Expected : `pnpm lint` retourne 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add biome for lint and format"
```

---

### Task 5: Installer et configurer Vitest

**Files:**
- Create: `vitest.config.ts`, `tests/unit/sanity.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Installer Vitest**

```bash
pnpm add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Créer vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3: Ajouter le script de test dans package.json**

Dans `"scripts"` :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Écrire un test sanity qui doit passer**

Créer `tests/unit/sanity.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';

describe('sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Lancer les tests**

```bash
pnpm test
```

Expected : `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add vitest with one sanity test"
```

---

### Task 6: Installer et configurer Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/sanity.spec.ts`
- Modify: `package.json` (scripts), `.gitignore`

- [ ] **Step 1: Installer Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

(L'installation de chromium prend ~1 min.)

- [ ] **Step 2: Créer playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
```

- [ ] **Step 3: Ajouter les scripts**

```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Ajouter Playwright outputs au .gitignore**

Append à `.gitignore` :

```
# Playwright
test-results/
playwright-report/
playwright/.cache/
```

- [ ] **Step 5: Écrire un E2E sanity qui visite la home par défaut**

Créer `tests/e2e/sanity.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';

test('home page responds 200', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
});
```

- [ ] **Step 6: Lancer le test E2E**

```bash
pnpm e2e
```

Expected : 1 passed. (Le serveur Next dev est démarré automatiquement par Playwright.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add playwright with one sanity e2e"
```

---

### Task 7: Module env validé (Zod)

**Files:**
- Create: `src/lib/env.ts`, `src/lib/env.test.ts`
- Modify: `package.json` (dépendance Zod)

Toute clé de config qu'on lit dans `process.env` passera par ce module pour être validée au démarrage. Évite les `undefined` silencieux en prod.

- [ ] **Step 1: Installer Zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Écrire le test (TDD)**

Créer `src/lib/env.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('returns a valid env object when all keys present', () => {
    const env = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      DATABASE_URL: 'postgres://user:pass@host:5432/db',
      OPENAI_API_KEY: 'sk-openai-xxx',
      NODE_ENV: 'test',
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://abc.supabase.co');
    expect(env.NODE_ENV).toBe('test');
  });

  it('throws if a required key is missing', () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        DATABASE_URL: 'postgres://x',
        OPENAI_API_KEY: 'k',
        NODE_ENV: 'test',
      }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('rejects an invalid URL for NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k',
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        DATABASE_URL: 'postgres://x',
        OPENAI_API_KEY: 'k',
        NODE_ENV: 'test',
      }),
    ).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier qu'il échoue**

```bash
pnpm test src/lib/env.test.ts
```

Expected : FAIL ("Cannot find module './env'").

- [ ] **Step 4: Implémenter le module**

Créer `src/lib/env.ts` :

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv | Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${messages}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function env(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
```

- [ ] **Step 5: Relancer le test**

```bash
pnpm test src/lib/env.test.ts
```

Expected : 3 passed.

- [ ] **Step 6: Créer .env.example**

Créer `.env.example` à la racine :

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgres://postgres:password@host:5432/postgres
OPENAI_API_KEY=sk-openai-xxx
NODE_ENV=development
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(lib): add zod-validated env module"
```

---

### Task 8: README projet

**Files:**
- Modify: `README.md` (créé par Next.js, à remplacer par notre version)

- [ ] **Step 1: Remplacer le README**

Écrire dans `README.md` :

```markdown
# Teyen

App web d'apprentissage de l'anglais jusqu'au CEFR C2, avec tuteur IA, exercices personnalisés et suivi adaptatif.

Spec et plans : `docs/superpowers/`.

## Stack

Next.js 15, TypeScript, Supabase (Postgres + Auth), Drizzle ORM, OpenAI SDK, Vitest, Playwright, Biome.

## Pré-requis

- Node.js ≥ 20
- pnpm
- Comptes : Supabase, Vercel, OpenAI, GitHub

## Setup local

\`\`\`bash
pnpm install
cp .env.example .env.local
# Remplir .env.local avec les clés du projet Supabase dev et la clé OpenAI
pnpm db:migrate
pnpm dev
\`\`\`

L'app tourne sur http://localhost:3000.

## Scripts

- \`pnpm dev\` — serveur de développement
- \`pnpm build\` — build de prod
- \`pnpm test\` — tests unitaires
- \`pnpm e2e\` — tests end-to-end
- \`pnpm lint\` — Biome lint
- \`pnpm typecheck\` — TypeScript
- \`pnpm db:generate\` — générer migration depuis le schéma
- \`pnpm db:migrate\` — appliquer migrations
- \`pnpm db:studio\` — ouvrir Drizzle Studio
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: project README"
```

---

## Phase 1 — Base de données

### Task 9: Créer les deux projets Supabase

**Files:** aucun (action humaine côté Supabase + remplissage de `.env.local`)

- [ ] **Step 1: Créer le projet dev**

Sur https://supabase.com/dashboard, créer un projet `teyen-dev` (région la plus proche, mot de passe DB fort enregistré dans un gestionnaire de mots de passe).

- [ ] **Step 2: Créer le projet test**

Idem, projet `teyen-test`.

- [ ] **Step 3: Récupérer les clés du projet dev**

Project Settings → API → copier :
- `URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

Project Settings → Database → Connection string → URI mode (cocher "use connection pooling" / port 6543) → copier en `DATABASE_URL`.

- [ ] **Step 4: Créer .env.local et le remplir**

```bash
cp .env.example .env.local
```

Éditer `.env.local`, remplir avec les vraies valeurs du projet dev + la clé OpenAI.

- [ ] **Step 5: Vérifier que `.env.local` est ignoré par git**

```bash
git status
```

Expected : `.env.local` n'apparaît PAS dans untracked. (Sinon, vérifier `.gitignore` contient bien `.env*` ou `.env.local`.)

- [ ] **Step 6: Créer un fichier de notes pour les credentials test**

Créer `.env.test.example` (qui sera committé) :

```
# Used by Playwright in CI and locally.
# Real values go in .env.test (gitignored).
NEXT_PUBLIC_SUPABASE_URL=https://teyen-test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-key
DATABASE_URL=postgres://postgres:password@host:5432/postgres
OPENAI_API_KEY=sk-openai-test
NODE_ENV=test
```

Et créer `.env.test` localement (gitignored) avec les vraies valeurs du projet `teyen-test`.

Ajouter au `.gitignore` si pas déjà couvert par le pattern `.env*` :

```
.env.test
.env.local
```

- [ ] **Step 7: Commit**

```bash
git add .env.test.example .gitignore
git commit -m "chore: add env templates for dev and test supabase projects"
```

---

### Task 10: Installer Drizzle ORM

**Files:**
- Create: `drizzle.config.ts`, `src/db/index.ts`
- Modify: `package.json` (deps + scripts)

- [ ] **Step 1: Installer les dépendances**

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

- [ ] **Step 2: Créer drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run drizzle-kit');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 3: Installer dotenv pour drizzle-kit**

```bash
pnpm add -D dotenv-cli dotenv
```

- [ ] **Step 4: Ajouter les scripts DB dans package.json**

```json
"db:generate": "dotenv -e .env.local -- drizzle-kit generate",
"db:migrate": "dotenv -e .env.local -- tsx src/db/migrate.ts",
"db:studio": "dotenv -e .env.local -- drizzle-kit studio",
"db:push": "dotenv -e .env.local -- drizzle-kit push"
```

- [ ] **Step 5: Installer tsx pour exécuter le script de migration**

```bash
pnpm add -D tsx
```

- [ ] **Step 6: Créer le client DB**

Créer `src/db/index.ts` :

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

const client = postgres(env().DATABASE_URL, { prepare: false });

export const db = drizzle(client, { schema });
export type DB = typeof db;
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: install drizzle orm and configure"
```

---

### Task 11: Définir le schéma Drizzle complet

**Files:**
- Create: `src/db/schema.ts`

Reflète exactement les 7 tables du spec §5.

- [ ] **Step 1: Écrire le schéma**

Créer `src/db/schema.ts` :

```typescript
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// --- ENUMs ---
export const skillKind = pgEnum('skill_kind', ['reading', 'writing', 'vocab', 'grammar']);

export const exerciseType = pgEnum('exercise_type', [
  'mcq',
  'fill_blank',
  'translate_fr_en',
  'translate_en_fr',
  'short_writing',
  'reading_comprehension',
  'vocab_recall',
]);

export const knowledgeKind = pgEnum('knowledge_kind', ['vocab', 'grammar_rule']);

export const turnRole = pgEnum('turn_role', ['user', 'assistant', 'tool', 'system_summary']);

// --- TABLES ---

// `users` mirrors a row from Supabase auth.users (linked by id).
// The FK to auth.users is added manually in a SQL migration (Task 13).
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  targetCefr: text('target_cefr').notNull().default('C2'),
  uiLang: text('ui_lang').notNull().default('fr'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  domains: text('domains').array().notNull().default(sql`'{}'::text[]`),
  interests: text('interests').array().notNull().default(sql`'{}'::text[]`),
  goalText: text('goal_text').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const skillLevels = pgTable(
  'skill_levels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skill: skillKind('skill').notNull(),
    cefrEstimate: numeric('cefr_estimate', { precision: 4, scale: 2 }).notNull(),
    confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull().default('0.30'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSkillUq: unique('skill_levels_user_skill_uq').on(t.userId, t.skill),
  }),
);

export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: exerciseType('type').notNull(),
    skill: skillKind('skill').notNull(),
    cefr: numeric('cefr', { precision: 4, scale: 2 }).notNull(),
    topic: text('topic').notNull(),
    domain: text('domain').notNull(),
    payload: jsonb('payload').notNull(),
    answerKey: jsonb('answer_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index('exercises_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    response: text('response').notNull(),
    score: numeric('score', { precision: 3, scale: 2 }).notNull(),
    feedback: text('feedback').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index('attempts_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export const knowledgeItems = pgTable(
  'knowledge_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: knowledgeKind('kind').notNull(),
    value: text('value').notNull(),
    mastery: integer('mastery').notNull().default(0),
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    masteryRange: check('mastery_range', sql`${t.mastery} BETWEEN 0 AND 5`),
    userReviewIdx: index('knowledge_user_review_idx').on(t.userId, t.nextReviewAt),
  }),
);

export const conversationTurns = pgTable(
  'conversation_turns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').notNull(),
    role: turnRole('role').notNull(),
    content: text('content').notNull(),
    toolName: text('tool_name'),
    toolPayload: jsonb('tool_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionCreatedIdx: index('conv_user_session_created_idx').on(
      t.userId,
      t.sessionId,
      t.createdAt,
    ),
  }),
);
```

- [ ] **Step 2: Vérifier que ça compile**

```bash
pnpm typecheck
```

Expected : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat(db): define complete drizzle schema for 7 mvp tables"
```

---

### Task 12: Script de migration et génération initiale

**Files:**
- Create: `src/db/migrate.ts`
- Create (généré) : `src/db/migrations/0000_*.sql`

- [ ] **Step 1: Écrire le runner de migration**

Créer `src/db/migrate.ts` :

```typescript
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  await sql.end();
  console.log('Migrations applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Générer la première migration**

```bash
pnpm db:generate
```

Expected : crée `src/db/migrations/0000_<silly_name>.sql` + `meta/`.

Ouvrir le `.sql` généré et vérifier qu'il crée bien 7 tables + 4 enums.

- [ ] **Step 3: Appliquer la migration sur le projet dev**

```bash
pnpm db:migrate
```

Expected : `Migrations applied.`

- [ ] **Step 4: Vérifier dans Supabase Studio**

Aller sur le dashboard Supabase → Table Editor. Voir les 7 tables présentes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add migrate script and generate initial migration"
```

---

### Task 13: Lier `users` à `auth.users` via une migration SQL manuelle

Drizzle ne sait pas référencer `auth.users` (table Supabase hors schéma public). On ajoute la FK et le trigger d'auto-population à la main, via une migration custom drizzle-kit.

**Files:**
- Create (généré) : `src/db/migrations/0001_*.sql` (édité à la main pour y mettre le SQL ci-dessous)

- [ ] **Step 1: Générer une migration vide**

```bash
pnpm dlx dotenv -e .env.local -- drizzle-kit generate --custom --name=link_auth_users
```

Expected : crée `src/db/migrations/0001_link_auth_users.sql` (vide) et met à jour `meta/_journal.json` automatiquement.

- [ ] **Step 2: Remplir le SQL**

Ouvrir `src/db/migrations/0001_link_auth_users.sql` et écrire :

```sql
-- Link public.users to auth.users
ALTER TABLE public.users
  ADD CONSTRAINT users_id_auth_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Auto-insert into public.users on signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

- [ ] **Step 3: Appliquer**

```bash
pnpm db:migrate
```

Expected : la migration 0001 est exécutée sans erreur.

- [ ] **Step 4: Vérifier**

Dans Supabase Studio → Database → Functions, voir `handle_new_auth_user`. Triggers → voir `on_auth_user_created` sur `auth.users`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): link public.users to auth.users with trigger"
```

---

### Task 14: Test de connexion DB

**Files:**
- Create: `src/db/connection.test.ts`

Test qui vérifie qu'on peut se connecter et requêter les 7 tables (count = 0). Tourne contre `.env.test`.

- [ ] **Step 1: Configurer Vitest pour charger .env.test**

Mettre à jour `vitest.config.ts`, ajouter la prop `env` :

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: '.env.test' });

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

- [ ] **Step 2: Ajouter un script `db:migrate:test` dans package.json**

Dans `"scripts"` :

```json
"db:migrate:test": "dotenv -e .env.test -- tsx src/db/migrate.ts"
```

Puis appliquer les migrations sur le projet test :

```bash
pnpm db:migrate:test
```

Expected : `Migrations applied.` (Une fois, manuellement, pour le projet test.)

- [ ] **Step 3: Écrire le test (TDD)**

Créer `src/db/connection.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { db } from './index';
import { users, profiles, skillLevels, exercises, attempts, knowledgeItems, conversationTurns } from './schema';

describe('database connection', () => {
  it('can query users table', async () => {
    const rows = await db.select().from(users).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('can query all 7 tables without error', async () => {
    await db.select().from(users).limit(1);
    await db.select().from(profiles).limit(1);
    await db.select().from(skillLevels).limit(1);
    await db.select().from(exercises).limit(1);
    await db.select().from(attempts).limit(1);
    await db.select().from(knowledgeItems).limit(1);
    await db.select().from(conversationTurns).limit(1);
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: Lancer**

```bash
pnpm test src/db/connection.test.ts
```

Expected : 2 passed. (Connexion au projet test OK.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(db): smoke test connection to all 7 tables"
```

---

## Phase 2 — Auth et pages

### Task 15: Clients Supabase (serveur + helper proxy)

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/proxy-helper.ts`
- Modify: `package.json`

- [ ] **Step 1: Installer le SDK Supabase Auth Helpers pour Next.js**

```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Client serveur (Server Components / Server Actions)**

Créer `src/lib/supabase/server.ts` :

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(env().NEXT_PUBLIC_SUPABASE_URL, env().NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The setAll method was called from a Server Component. Ignore.
        }
      },
    },
  });
}
```

- [ ] **Step 3: Helper proxy (rafraîchit la session)**

Créer `src/lib/supabase/proxy-helper.ts`. En Next 16, la convention `middleware.ts` est renommée `proxy.ts`, et la fonction exportée doit s'appeler `proxy`. Ce helper est appelé par le `proxy.ts` racine (Task 16) :

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env().NEXT_PUBLIC_SUPABASE_URL,
    env().NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  return { response, user };
}
```

- [ ] **Step 4: Vérifier compilation**

```bash
pnpm typecheck
```

Expected : 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase package.json pnpm-lock.yaml
git commit -m "feat(auth): supabase server client and proxy session helper"
```

---

### Task 16: Proxy Next.js pour protéger les routes `(app)`

En Next 16, la convention `middleware.ts` est renommée `proxy.ts`. Même mécanisme, nouveau nom.

**Files:**
- Create: `src/proxy.ts`

- [ ] **Step 1: Créer le proxy**

Créer `src/proxy.ts` :

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy-helper';

const PROTECTED_PREFIXES = ['/home'];
const AUTH_PAGES = ['/login', '/signup'];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const isAuthPage = AUTH_PAGES.includes(pathname);
  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(auth): proxy protects /home and redirects authed users from /login"
```

---

### Task 17: Composants UI basiques (Button, Input)

**Files:**
- Create: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`

Volontairement simples, sans dépendance externe (pas de shadcn pour ce plan ; on garde minimal).

- [ ] **Step 1: Button**

Créer `src/components/ui/button.tsx` :

```typescript
import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className = '', variant = 'primary', ...props },
  ref,
) {
  const base =
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-black text-white hover:bg-gray-800 focus:ring-black',
    ghost: 'bg-transparent text-black hover:bg-gray-100 focus:ring-gray-300',
  } as const;
  return <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />;
});
```

- [ ] **Step 2: Input**

Créer `src/components/ui/input.tsx` :

```typescript
import { type InputHTMLAttributes, forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black ${className}`}
      {...props}
    />
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui
git commit -m "feat(ui): minimal Button and Input components"
```

---

### Task 18: Page de signup

**Files:**
- Create: `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/signup/actions.ts`, `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Layout des pages auth**

Créer `src/app/(auth)/layout.tsx` :

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-sm">{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Server action signup**

Créer `src/app/(auth)/signup/actions.ts` :

```typescript
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SignupResult = { ok: false; error: string };

export async function signupAction(_prev: SignupResult | null, formData: FormData): Promise<SignupResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Email et mot de passe requis.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Le mot de passe doit faire au moins 8 caractères.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect('/home');
}
```

- [ ] **Step 3: Page signup**

Créer `src/app/(auth)/signup/page.tsx` :

```typescript
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signupAction, type SignupResult } from './actions';

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<SignupResult | null, FormData>(
    signupAction,
    null,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Créer un compte</h1>
      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <Input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Mot de passe</span>
          <Input type="password" name="password" required autoComplete="new-password" />
        </label>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
      <p className="text-sm text-gray-600">
        Déjà un compte ?{' '}
        <Link href="/login" className="underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Smoke test manuel**

```bash
pnpm dev
```

Aller sur http://localhost:3000/signup. Créer un compte avec un email perso. Vérifier qu'on est redirigé vers `/home` (qui n'existe pas encore — Next.js 404. On la crée Task 21).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(auth): signup page with server action"
```

---

### Task 19: Page de login

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`

- [ ] **Step 1: Server action login**

Créer `src/app/(auth)/login/actions.ts` :

```typescript
'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LoginResult = { ok: false; error: string };

export async function loginAction(_prev: LoginResult | null, formData: FormData): Promise<LoginResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Email et mot de passe requis.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: 'Identifiants invalides.' };
  }

  redirect('/home');
}
```

- [ ] **Step 2: Page login**

Créer `src/app/(auth)/login/page.tsx` :

```typescript
'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loginAction, type LoginResult } from './actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Se connecter</h1>
      <form action={formAction} className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <Input type="email" name="email" required autoComplete="email" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Mot de passe</span>
          <Input type="password" name="password" required autoComplete="current-password" />
        </label>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
      <p className="text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(auth): login page with server action"
```

---

### Task 20: Logout (Server Action)

**Files:**
- Create: `src/app/api/auth/logout/route.ts`

On utilise un Route Handler POST plutôt qu'une action pour qu'un bouton simple puisse poster.

- [ ] **Step 1: Route logout**

Créer `src/app/api/auth/logout/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(auth): logout route"
```

---

### Task 21: Page d'accueil derrière login

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/app/(app)/home/page.tsx`, `src/components/logout-button.tsx`

Page placeholder très simple : "Bienvenue {email}" + bouton logout. Les vraies fonctionnalités viennent dans les plans suivants.

- [ ] **Step 1: Layout de l'app**

Créer `src/app/(app)/layout.tsx` :

```typescript
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold">Teyen</span>
          <span className="text-sm text-gray-600">{user.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Bouton logout**

Créer `src/components/logout-button.tsx` :

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from './ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleLogout() {
    start(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" disabled={pending} onClick={handleLogout}>
      {pending ? 'Déconnexion…' : 'Se déconnecter'}
    </Button>
  );
}
```

- [ ] **Step 3: Page home**

Créer `src/app/(app)/home/page.tsx` :

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/logout-button';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Bienvenue sur Teyen</h1>
      <p className="text-gray-700">
        Connecté en tant que <strong>{user?.email}</strong>. Le test de placement et le tuteur arrivent
        dans les prochaines versions.
      </p>
      <LogoutButton />
    </section>
  );
}
```

- [ ] **Step 4: Modifier la page d'accueil publique pour rediriger les loggés vers /home**

Remplacer `src/app/page.tsx` par :

```typescript
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-4xl font-bold">Teyen</h1>
      <p className="max-w-md text-gray-700">
        Apprends l'anglais jusqu'au niveau C2 avec un tuteur IA qui s'adapte à toi.
      </p>
      <div className="flex gap-3">
        <Link href="/signup"><Button>Commencer</Button></Link>
        <Link href="/login"><Button variant="ghost">Se connecter</Button></Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Smoke test manuel**

```bash
pnpm dev
```

Vérifier le flow complet : `/` → `/signup` → `/home` → bouton logout → `/login`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(app): home page and landing with auth-aware navigation"
```

---

### Task 22: Test E2E du flow auth complet

**Files:**
- Create: `tests/e2e/auth.spec.ts`
- Modify: `tests/e2e/sanity.spec.ts` (supprimé)

- [ ] **Step 1: Supprimer le sanity test**

```bash
rm tests/e2e/sanity.spec.ts
```

- [ ] **Step 2: Écrire le test E2E auth**

Créer `tests/e2e/auth.spec.ts` :

```typescript
import { test, expect } from '@playwright/test';

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
  await expect(page.getByText(email)).toBeVisible();

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
  await expect(page.getByRole('alert')).toContainText(/8 caractères/);
});

test('login rejects bad credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('does-not-exist@teyen.test');
  await page.getByLabel('Mot de passe').fill('whatever123');
  await page.getByRole('button', { name: /^Se connecter$/i }).click();
  await expect(page.getByRole('alert')).toContainText(/invalides/);
});

test('/home redirects to /login when not authenticated', async ({ page }) => {
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 3: Reconfigurer Playwright pour charger `.env.test`**

Remplacer entièrement `playwright.config.ts` par :

```typescript
import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load env for the Playwright process (so test code can read it if needed).
config({ path: '.env.test' });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Pass .env.test to the spawned Next dev server so it talks to teyen-test.
        command: process.env.CI ? 'pnpm next dev' : 'pnpm dlx dotenv -e .env.test -- pnpm next dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
```

(In CI, the workflow already exports the env vars from GitHub secrets, so the wrapper isn't needed.)

- [ ] **Step 4: Lancer**

```bash
pnpm e2e
```

Expected : 4 passed.

Note : ces tests créent de vrais users dans `teyen-test`. Ne pas connecter ce projet à un mailer en prod (sinon il enverra des vrais mails de confirmation). Désactiver la confirmation email dans **Supabase Dashboard → Authentication → Providers → Email → "Confirm email"** pour le projet test.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(e2e): signup, login, logout and protected route redirect"
```

---

## Phase 3 — API & santé

### Task 23: Endpoint /api/health

**Files:**
- Create: `src/app/api/health/route.ts`, `src/app/api/health/route.test.ts`

- [ ] **Step 1: Écrire le test**

Créer `src/app/api/health/route.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  it('returns ok with timestamp', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.now).toBe('string');
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

```bash
pnpm test src/app/api/health/route.test.ts
```

Expected : FAIL ("Cannot find module './route'").

- [ ] **Step 3: Implémenter**

Créer `src/app/api/health/route.ts` :

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, now: new Date().toISOString() });
}
```

- [ ] **Step 4: Relancer**

```bash
pnpm test src/app/api/health/route.test.ts
```

Expected : 1 passed.

- [ ] **Step 5: Smoke manuel**

```bash
pnpm dev
curl http://localhost:3000/api/health
```

Expected : `{"ok":true,"now":"2026-..."}`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): health endpoint"
```

---

### Task 24: Endpoint /api/me (utilisateur courant)

**Files:**
- Create: `src/app/api/me/route.ts`, `src/lib/auth.ts`, `src/lib/auth.test.ts`

Premier endpoint qui croise auth + DB. Pose le pattern pour tous les futurs endpoints.

- [ ] **Step 1: Helper auth pour requêtes API**

Créer `src/lib/auth.ts` :

```typescript
import { createSupabaseServerClient } from './supabase/server';

export type AuthedUser = { id: string; email: string };

export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    throw new UnauthorizedError();
  }
  return { id: user.id, email: user.email };
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}
```

- [ ] **Step 2: Test du helper**

Créer `src/lib/auth.test.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from './auth';

describe('UnauthorizedError', () => {
  it('is identifiable by name', () => {
    const err = new UnauthorizedError();
    expect(err.name).toBe('UnauthorizedError');
    expect(err instanceof Error).toBe(true);
  });
});
```

(Un test d'intégration plus poussé viendra avec le mocking de Supabase au Plan 2 ; ici on se contente du contrat de l'erreur.)

- [ ] **Step 3: Endpoint /api/me**

Créer `src/app/api/me/route.ts` :

```typescript
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser, UnauthorizedError } from '@/lib/auth';

export async function GET() {
  try {
    const authed = await requireUser();
    const rows = await db.select().from(users).where(eq(users.id, authed.id)).limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'User row missing' }, { status: 500 });
    }
    return NextResponse.json({ id: row.id, email: row.email, targetCefr: row.targetCefr });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
```

- [ ] **Step 4: E2E sur /api/me**

Ajouter à `tests/e2e/auth.spec.ts` :

```typescript
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
```

- [ ] **Step 5: Lancer**

```bash
pnpm e2e tests/e2e/auth.spec.ts
```

Expected : tous les tests passent.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): /api/me with requireUser helper"
```

---

## Phase 4 — CI & déploiement

### Task 25: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Workflow CI**

Créer `.github/workflows/ci.yml` :

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL_TEST }}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_TEST }}
      DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium

      - name: E2E tests
        run: pnpm e2e

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: github actions running lint, typecheck, unit and e2e"
```

(Les secrets seront configurés à la Task 27.)

---

### Task 26: Pousser sur GitHub

- [ ] **Step 1: Créer la remote**

(Le repo GitHub vide a été créé en pré-requis.)

```bash
git remote add origin git@github.com:<TON_USER>/teyen.git
git branch -M main
git push -u origin main
```

Expected : push réussi.

- [ ] **Step 2: Configurer les secrets GitHub Actions**

Sur GitHub : Settings → Secrets and variables → Actions → New repository secret. Ajouter pour chacun :
- `NEXT_PUBLIC_SUPABASE_URL_TEST`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST`
- `SUPABASE_SERVICE_ROLE_KEY_TEST`
- `DATABASE_URL_TEST`
- `OPENAI_API_KEY`

Avec les valeurs du projet `teyen-test` et la clé OpenAI.

- [ ] **Step 3: Vérifier que le CI tourne**

Aller dans l'onglet Actions du repo. Le workflow doit s'être déclenché sur le push. Vérifier qu'il passe au vert.

Si l'E2E échoue parce que le projet test impose la confirmation d'email, retourner dans Supabase Dashboard du projet test → Authentication → Providers → Email → décocher "Confirm email", puis relancer le workflow.

---

### Task 27: Déployer sur Vercel

- [ ] **Step 1: Importer le projet sur Vercel**

Sur https://vercel.com/new, importer le repo GitHub `teyen`. Framework détecté automatiquement : Next.js.

- [ ] **Step 2: Ajouter les variables d'env Production**

Dans la config Vercel du projet, onglet "Environment Variables" :
- `NEXT_PUBLIC_SUPABASE_URL` = (url du projet `teyen-dev`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `NODE_ENV=production`

Note : on déploie d'abord le projet dev en prod Vercel — c'est OK pour un MVP. Plus tard on créera un projet Supabase prod dédié.

- [ ] **Step 3: Déclencher le déploiement**

Cliquer "Deploy". Attendre ~2 min.

- [ ] **Step 4: Smoke test prod**

Aller sur l'URL Vercel `https://teyen-<hash>.vercel.app`. Vérifier :
- La page d'accueil s'affiche.
- `/signup` permet de créer un compte (utilise un email perso).
- Après signup on est redirigé sur `/home`.
- `/api/health` renvoie 200.

- [ ] **Step 5: Commit (rien à committer mais on marque la fin)**

L'URL Vercel est enregistrée dans Vercel — pas de fichier à committer. Marquer cette tâche comme terminée.

---

## Critère de fin de Plan 1

Le plan est considéré terminé quand :
- ✅ `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` passent en local.
- ✅ Le CI GitHub Actions est vert sur `main`.
- ✅ Le déploiement Vercel est accessible et le flow signup → home → logout marche en prod.
- ✅ Les 7 tables existent dans le projet Supabase dev et test.
- ✅ La trigger `on_auth_user_created` crée bien une ligne dans `public.users` et `public.profiles` au signup (vérifiable dans Supabase Studio).

Aucun comportement métier (placement, exercices, chat, engine) n'est implémenté à ce stade — c'est le Plan 2 et suivants.

---

## Ce qui reste (plans à venir)

- **Plan 2** : profil utilisateur (UI + persistance), exercise generator initial (1-2 types), orchestration du placement adaptatif, initialisation `skill_levels`.
- **Plan 3** : pedagogical_engine déterministe avec tests unitaires complets.
- **Plan 4** : chat agent (OpenAI SDK + tools), page chat, cartes exercice, LLM-juge writing.
- **Plan 5** : progress_tracker UI, série de jours, résumé de conversation, cost cap, suppression compte.
