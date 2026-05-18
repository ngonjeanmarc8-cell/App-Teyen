# Teyen

App web d'apprentissage de l'anglais jusqu'au CEFR C2, avec tuteur IA, exercices personnalisés et suivi adaptatif.

Spec et plans : `docs/superpowers/`.

## Stack

Next.js 16, TypeScript, Supabase (Postgres + Auth), Drizzle ORM, OpenAI SDK, Vitest, Playwright, Biome.

## Pré-requis

- Node.js ≥ 20
- pnpm
- Comptes : Supabase, Vercel, OpenAI, GitHub

## Setup local

```bash
pnpm install
cp .env.example .env.local
# Remplir .env.local avec les clés du projet Supabase dev et la clé OpenAI
pnpm db:migrate
pnpm dev
```

L'app tourne sur http://localhost:3000.

## Scripts

- `pnpm dev` — serveur de développement
- `pnpm build` — build de prod
- `pnpm test` — tests unitaires
- `pnpm e2e` — tests end-to-end
- `pnpm lint` — Biome lint
- `pnpm typecheck` — TypeScript
- `pnpm db:generate` — générer migration depuis le schéma
- `pnpm db:migrate` — appliquer migrations
- `pnpm db:studio` — ouvrir Drizzle Studio
