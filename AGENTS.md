# AGENTS.md — rules for AI agents working on V's Kitchen

Applies to any agent (Claude, Codex/GPT, etc.) touching this repo or logging the household's
meals in Cronometer. Harsh is a physician, not a developer — keep changes simple, correct, and
explained in plain English.

## What this project is

Recipe database + portioning reference for a two-person, protein-forward vegetarian household.
Logging happens in **Cronometer**; this app answers "what do we cook and how many grams is my
portion?" Stack: Vite + React static SPA on GitHub Pages, no backend.

- **Data** lives in [`public/data/recipes.json`](public/data/recipes.json): an ingredient
  library (`ingredients`, keyed, each with `per100g` macros) plus `recipes` (gram amounts that
  reference ingredient keys via `ref`).
- **Nutrition is always computed from `per100g` × grams, never stored per recipe.** Do not add
  cached calorie/macro totals to a recipe object. If a recipe's numbers look wrong, fix the
  ingredient's `per100g` in the library — every recipe using it updates at once.
- There are no per-person profiles. Both people eat the same portion; the app plans
  against one unlabelled baseline target (`DAILY_TARGET` in `src/lib/scheduler.js`) and any
  individual surplus is handled at Cronometer logging time, outside the app.
- The phone app also writes `recipes.json` via the GitHub Contents API (SHA-checked, recipe-level
  merge on conflict). Keep commits **data-only** when you change recipes so those merges stay clean.

## Working rules (non-negotiable)

1. **Simplest thing that fully works.** Minimum edits, no speculative abstraction. If you add a
   better mechanism, delete the one it replaces in the same change.
2. **Root cause before fix.** A fix you can't explain mechanistically is a guess. Don't pattern-match
   a symptom to a known fix without confirming the actual cause.
3. **Numbers are recomputed, never transcribed.** Any calorie/macro figure you write in a note or
   commit message is recomputed from `per100g` × grams (or pulled fresh from Cronometer), not copied
   from memory or an old note. Mark anything you couldn't verify as `[unverified]`.
4. **Verify before you commit.** `recipes.json` must stay valid JSON and the app must still build
   (`npm run dev` or `npm run build`). State what you checked.
5. **Don't change methodology silently.** How nutrition is computed, what fields exist, the merge
   behaviour — flag proposed changes to Harsh with a recommendation; don't just do them.
6. **No fabrication.** If you don't know an ingredient's real macros, say so; don't invent a
   plausible `per100g`. Prefer values from the product label or a named database entry.

## Ingredient standards

Before creating or logging anything, map generic names to the household's actual products using
[`standard-ingredients.md`](standard-ingredients.md) (e.g. "greek yogurt" → Kirkland Organic Non-Fat;
"monk fruit" → Whole Earth Monk Fruit Allulose Blend). Add a row there whenever a new standard is
set. In Cronometer, search for the exact branded product first; fall back to a generic entry only if
it's not in the database.

## Cronometer: two accounts

- `cronometer_account_a` = **Harsh**, `cronometer_account_b` = **Vruddhi**. Separate connections;
  **custom foods and recipes do NOT sync between accounts** — anything shared is a fresh recreate.
- If the target account is unclear, ask.

Three cases:

1. **"I added X in Cronometer" → mirror nutrition to Vruddhi.** Pull X's full nutrient profile
   (macros + every micro) from Harsh's food log, recreate it as a custom food in Vruddhi's account,
   and log it to the same date/meal. Do **not** reproduce individual ingredients on her side —
   nutrition parity is all that's wanted. Note that it's a point-in-time snapshot.
2. **Plain-language recipe → build in BOTH accounts.** Create it as a real recipe in each Cronometer
   account with actual database ingredients where possible, applying the ingredient standards above.
   Then add/update the same recipe in `recipes.json`.
3. **Might be a repeat → search first, reuse.** Search Cronometer in BOTH accounts for an existing
   recipe/custom food before creating a duplicate. Consolidate rather than pile up near-duplicates.

## Pushing changes

After any change to app recipe data (`public/data/recipes.json`,
`standard-ingredients.md`), **commit and push to `main` without waiting for Harsh to ask.** Push to
`main` auto-deploys to GitHub Pages (`.github/workflows/deploy.yml`). This is low-stakes — it's a
family recipe app with no health data.

- Keep recipe-data commits separate from code/tooling commits.
- Clear, specific commit messages; recompute any numbers you cite.
- End commit messages with the co-author trailer your harness specifies.
- Code changes (src/, build config, workflows) still get the normal care — build and sanity-check
  before pushing; if unsure, leave it for Harsh.
