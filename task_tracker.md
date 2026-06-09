# RecipAI Task Tracker

Last updated: 2026-06-09

## Current Status

Milestones 1-5 are implemented through shopping lists. The repo has a runnable mobile-first Next.js app with local SQLite recipes, structured AI prompting, database-backed recipe library, saved dinner planning, and editable grocery lists generated from plans.

Completed foundation:

- [x] npm workspace scaffold
- [x] Next.js app shell with Ask, Library, Plan, Shop, Cook, Settings
- [x] Mobile-first design tokens and starter components
- [x] SQLite schema for recipes, AI runs, meal plans, and shopping lists
- [x] Seed recipe fixtures and seed script
- [x] Typed AI response contracts
- [x] Product, architecture, UX, AI response, testing, and agent docs
- [x] Typecheck, lint, tests, build, seed script, and mobile render check

## Next Priority: Milestone 2 - AI Foundation

Goal: make the Ask screen real while preserving the non-chatbot product experience.

- [x] Add server-side AI provider adapter for OpenAI.
- [x] Add server-side AI provider adapter for DeepSeek.
- [x] Read provider choice from local environment config.
- [x] Add local API route or server action for AI recipe prompts.
- [x] Implement general recipe prompt construction.
- [x] Implement saved-recipe modification prompt construction.
- [x] Validate provider responses with `packages/ai` schemas.
- [x] Persist AI runs to SQLite with prompt, provider, mode, source recipe, structured response, and save status.
- [x] Add invalid-response recovery UI instead of showing raw chatbot text.
- [x] Add mocked provider tests for schema extraction and saved-recipe prompt context.
- [ ] Add full mocked API route/provider tests for success, schema failure, provider error, and missing API key.
- [ ] Add real save/replace recipe actions from AI results.

Acceptance:

- [x] User can submit a general recipe prompt from Ask.
- [x] User can choose a saved recipe and ask for changes.
- [x] AI output renders as structured recipe UI, not chat bubbles.
- [ ] AI result can be saved as a recipe draft or saved recipe.
- [x] `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass.

## Milestone 3 - Recipe Library

Goal: make stored recipes useful without AI.

- [x] Add database query layer for recipe CRUD.
- [x] Replace Library seed-only UI data with SQLite-backed recipe reads.
- [x] Add recipe detail screen.
- [x] Add create/edit recipe form.
- [x] Add rating and favorite flows.
- [x] Add full-text search over title, summary, tags, and ingredients.
- [x] Extend search index to notes and source.
- [x] Add filters for favorites, tags, rating, and recent cooking.
- [x] Add URL import review screen placeholder, even if parser comes later.

Acceptance:

- [x] User can create, edit, rate, favorite, find, and open recipes.
- [x] Library is fast and clean on mobile.
- [x] Search returns useful results from seeded and manually added recipes.

## Milestone 4 - Meal Planning

Goal: assign random saved dinners across a selected date range.

- [x] Add meal-planning package or module for date-range generation.
- [x] Generate one dinner per day for a selected range.
- [x] Default planning range to 14 days where useful.
- [x] Avoid duplicate recipes within a range when enough recipes exist.
- [x] Add lock, reroll one day, reroll unlocked days, clear range, and save plan.
- [x] Add manual recipe picking with fuzzy searchable menu.
- [x] Persist meal plans to SQLite.
- [x] Open a planned recipe directly into cooking mode.

Acceptance:

- [x] User can generate, adjust, save, and revisit a dinner plan.
- [x] Locked meals survive rerolls.
- [x] Planning UI stays comfortable on phone screens.

## Milestone 5 - Shopping Lists

Goal: generate editable grocery lists from planned dinners.

- [x] Add shopping-list package or module for ingredient aggregation.
- [x] Generate from planned meals for a date range.
- [x] Default range to the next 14 days.
- [x] Merge compatible ingredients.
- [x] Preserve ambiguous unit conversions as separate items.
- [x] Group by grocery category with `Other` fallback.
- [x] Add checkoff, manual add, edit, delete, and clear completed.
- [x] Persist generated lists so edits are not lost.
- [x] Add print/export-friendly view.

Acceptance:

- [x] User can generate a useful 14-day list from planned dinners.
- [x] List remains editable after generation.
- [x] Ambiguous ingredients do not get incorrectly merged.

## Milestone 6 - Cooking Mode

Goal: make the app genuinely useful while cooking.

- [ ] Add large step-by-step cooking view.
- [ ] Add ingredient checklist.
- [ ] Add timers from recipe steps.
- [ ] Add serving scaling.
- [ ] Add screen-awake behavior where browser support allows.
- [ ] Add notes while cooking.
- [ ] Add "mark cooked" flow to update last cooked date.
- [ ] Launch cooking mode from Library, AI result, or Meal Plan.

Acceptance:

- [ ] User can cook a recipe from start to finish without fighting the UI.
- [ ] Text is readable at kitchen distance on mobile.
- [ ] Timers and scaling work without layout shifts.

## Milestone 7 - Import, Backup, And Polish

Goal: round out local-first durability and long-term usability.

- [ ] Add URL import parser for common recipe metadata.
- [ ] Add review/edit-before-save import flow.
- [ ] Add JSON export.
- [ ] Add SQLite backup copy flow.
- [ ] Add local-network setup notes for phones on home Wi-Fi.
- [ ] Add empty, loading, error, offline, and missing-provider states across screens.
- [ ] Add Playwright mobile smoke tests for core flows.
- [ ] Run a dedicated UI polish pass on phone and tablet viewports.

Acceptance:

- [ ] Family can add recipes from URLs or manually.
- [ ] Data can be backed up locally.
- [ ] The app feels coherent, fast, and polished across core flows.

## Known Follow-Ups

- [ ] Decide whether to support breakfast/lunch meal planning after dinner planning is solid.
- [ ] Decide whether to add pantry inventory after shopping lists are reliable.
- [ ] Decide whether future cloud sync is worth the complexity.
- [ ] Review `npm audit` findings before production-like usage; avoid `npm audit fix --force` unless breakage is acceptable.
