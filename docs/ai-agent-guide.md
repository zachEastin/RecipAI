# AI Agent Guide

Use this file before making changes.

## Rules

- Keep AI provider code behind `packages/ai`.
- Keep recipe-domain behavior in `packages/recipes`.
- Keep database schema and query helpers in `packages/db`.
- Do not put business logic directly in screen components when it belongs in a package.
- Do not build a generic chatbot UI unless the product direction changes.
- Preserve mobile-first UX and bottom navigation.

## Completion Checks

Before calling work complete, run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

For UI changes, also inspect a mobile viewport and verify text does not overlap, clip, or feel cramped.

## Adding Features

Start by updating or reading the relevant doc. Add focused tests for shared package behavior, then wire the app UI. Keep visible copy family-friendly and specific.
