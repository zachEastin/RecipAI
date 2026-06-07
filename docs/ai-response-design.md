# AI Response Design

AI responses are product data, not transcripts.

## General Recipe Result

Render as a saveable recipe view with:

- title
- summary
- servings
- total time
- difficulty
- tags
- ingredients
- steps
- tips
- substitutions

Primary actions: `Save recipe`, `Start cooking`, `Ask follow-up`.

## Saved Recipe Modification Result

Render as a friendly change view with:

- change summary
- serving impact
- time impact
- updated ingredients
- updated steps
- comparison to the original where useful

Primary actions: `Save as new`, `Replace original`, `Start cooking`.

## Invalid Provider Output

If output fails schema validation, show a recovery state that explains the result could not be formatted and offers retry. Do not show raw provider output by default.
