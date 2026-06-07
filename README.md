# RecipAI

RecipAI is a local-first, mobile-first recipe app for family use. The main experience is prompting AI for recipes or saved-recipe changes, then seeing structured recipe views instead of chatbot output.

## Stack

- Next.js PWA in `apps/web`
- TypeScript npm workspaces
- SQLite via `better-sqlite3`
- Shared packages for recipes, AI contracts, and database setup

## Local Setup

```bash
npm install
cp .env.example .env
npm run db:seed
npm run dev
```

Open `http://localhost:3000` on the local machine. For phone testing over home Wi-Fi, run the dev server with a LAN hostname once the machine and firewall are configured.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test
npm run db:seed
```

## Milestone 1 Scope

This milestone establishes the foundation: app shell, mobile design system, docs, SQLite schema, seed recipes, and typed AI response contracts. It does not call OpenAI or DeepSeek yet.
