# V's Kitchen — family recipe PWA

Recipe database and portioning reference for a two-person household on a protein-forward
vegetarian plan. Logging lives in Cronometer; this app answers "what should we cook, and
how many grams is my portion?"

- **Stack**: Vite + React static SPA, GitHub Pages, no backend.
- **Database**: [`public/data/recipes.json`](public/data/recipes.json) in this repo —
  ingredient library (per-100g macros) + recipes (gram amounts). All nutrition is
  computed, never stored per-recipe, so swapping an ingredient updates everything.
- **Writes**: the app commits to that file via the GitHub Contents API with each user's
  fine-grained PAT. Sha-checked writes with recipe-level merge on conflict; offline edits
  queue in localStorage and flush on reconnect.
- **Scheduling**: [`src/lib/scheduler.js`](src/lib/scheduler.js) builds a day in one click —
  protein is the only hard constraint, and each day is scored against a single baseline
  target. Both people eat the same portion, so there are no per-person profiles.
- **Balance today**: the Schedule screen accepts Vruddhi's current calories, protein, net carbs,
  and fat, then ranks recipes by how well one serving fits the remaining 1,500 kcal / 128 g
  baseline. These temporary totals stay in that device's local storage and are never synced.

Non-developer setup: see [SETUP.md](SETUP.md).

## Development

```
npm install
npm run dev
```

Deploys automatically to GitHub Pages on push to `main`
(`.github/workflows/deploy.yml`). Data-only commits made from the app also trigger a
deploy, but reads don't wait for it — the app fetches fresh data via the GitHub API.
