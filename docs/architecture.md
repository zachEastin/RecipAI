# Architecture

RecipAI is a TypeScript npm workspace.

## Boundaries

- `apps/web`: Next.js app, local API routes, screens, and UI components.
- `packages/recipes`: recipe types, fixtures, parsing, scaling, and recipe-domain helpers.
- `packages/ai`: provider-neutral AI contracts, schemas, prompt modes, and future adapters.
- `packages/db`: SQLite schema, migrations, seed script, and query helpers.
- Future `packages/meal-planning`: date-range assignment, lock, reroll, and history behavior.
- Future `packages/shopping-list`: ingredient aggregation, grouping, and checkoff behavior.

## Data Flow

The local machine owns the SQLite database. Browser screens call local Next.js routes or server actions. AI providers are accessed only from the local server side, never directly from the browser.

## AI Boundary

AI output must pass through typed schemas in `packages/ai`. UI code should render structured result objects, not provider text. Provider-specific concerns belong behind an adapter.

## Local Data

`DATABASE_URL` must use a `file:` SQLite path. API keys remain in environment variables and are never stored in SQLite.
