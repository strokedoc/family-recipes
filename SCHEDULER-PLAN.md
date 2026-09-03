# One-click day scheduler — implementation plan

Status: **planned, not built.** Written 2026-09-03. Read alongside [AGENTS.md](AGENTS.md).

## What it does

One button fills a day with recipes that hit the household protein target while keeping the
other macros sensible. Breakfast is always the protein smoothie. Lunch and dinner are picked
from protein-anchor mains. A flexible "protein filler" slot absorbs whatever protein is left
over, choosing the cheapest option in calories that closes the gap.

Any slot can then be clicked to swap it for something with similar macros.

**Target: 100–130 g protein/day, same plan for both people.** Vruddhi's lower calorie goal is
handled by adjusting portion sizes at logging time, **not** in the app — see Out of scope.

## Why this is a small feature

The constants do most of the work. The protein smoothie is ~44 g protein. Once lunch and dinner
each clear a 20 g floor, the day is already at ~85 g and the filler only has to close a small
residual. There is no optimisation problem here — it is "pick two mains above a floor, then pick
the filler that closes the gap." No solver, no dependency.

## Prerequisite: the library is not shaped for this yet

`category` is too coarse. Today `lunch-dinner` holds a mix of protein mains, sides, and breads,
so a naive picker will schedule Jowar rotla (6 g protein) as dinner. Two new fields fix it.

### 1. `role` on every recipe — **required**

| role | meaning | scheduler use |
|---|---|---|
| `main` | carries the meal's protein | eligible for lunch/dinner slots |
| `side` | vegetable/gravy accompaniment | optional garnish on a plate |
| `bread` | roti, thepla, rotla, paratha | optional garnish on a plate |
| `filler` | drink/bowl used to top up protein | eligible for the filler slot |
| `constant` | fixed daily item | breakfast slot |

Initial tagging (17 `lunch-dinner` + fillers), by protein per serving:

- **main**: moong-dal-chilla (31.7), paneer-frankie (31.2), lahsooni-palak-paneer (26.7),
  tofu-enchiladas (26.3), paneer-tikka (24.0), palak-paneer-light (21.6), paneer-bhurji (21.4),
  gatte-ki-sabzi (19.5)*, soya-keema (17.8)*, protein-toor-dal (16.5)*, tofu-bhurji (16.4)*
- **side**: tandaljo-bhaji, besan-stuffed-peppers, cucumber-raita, sprouted-moth, guacamole
- **bread**: jowar-rotla, tofu-atta-rotis, besan-paratha, methi-tofu-thepla
- **filler**: fairlife-nutrition-plan (to add), yogurt-protein-bowl, cucumber-raita, chhaas
- **constant**: protein-smoothie

\* below the 20 g floor as single servings — they qualify as mains only when paired with a side
that lifts the plate over 20 g, or at a larger portion. Tag them `main` and let the floor check
run on the assembled plate, not the recipe.

### 2. `proteinSource` on mains — optional but cheap

`paneer | tofu | dal | soya | yogurt | besan | chickpea`. Used only so lunch and dinner don't both
come back paneer. Nice-to-have; skip if it slows the tagging pass.

### 3. Add the Fairlife drink

Not in the library at all. Add as a recipe with `role: filler`, ~30 g protein / ~150 kcal
per bottle. Confirm against the label before committing the numbers.

### 4. Fix miscategorised recipes

`moong-dal-chilla` was filed as `breakfast`; corrected to `lunch-dinner` 2026-09-03. Audit the
rest of `breakfast` for other mains that are really lunches.

## Scheduler algorithm

Pure function, no UI. `buildDay(data, date, opts) -> { slots, totals, warnings }`.

```
1. breakfast  = the `constant` recipe (protein smoothie).       ~44 g P
2. lunchMain  = pick from role=main, not used in last 7 days.
3. dinnerMain = same, different recipe, prefer a different proteinSource.
4. Assembled-plate floor: each of lunch and dinner must reach >= 20 g protein.
   If a main falls short, attach a side/bread until the plate clears 20 g,
   or reject that main and pick another.
5. gap = 100 - (breakfast + lunch + dinner) protein.
6. filler = the LOWEST-CALORIE role=filler item whose protein >= gap.
   gap <= 5 g  -> chhaas (or nothing).
   no single filler closes the gap -> take the highest-protein one, warn.
7. Validate total protein in [100, 130]. If outside, retry steps 2-3 up to
   ~20 times, then RETURN THE BEST ATTEMPT WITH A WARNING.
```

**Design rules that keep this simple — do not violate:**

- **Protein is the only hard constraint. Everything else is a soft score.** Ranking candidates
  on carbs/fat/fiber is fine; rejecting on them is not. With a library this size, hard macro
  bands produce "no valid day" constantly and the button becomes useless.
- **Never hard-fail.** Always return a day plus warnings. A slightly-off day the user can swap
  from beats an error message.
- **Variety:** exclude anything used in the last 7 days. If that empties the pool, relax to 3
  days, then to 0. Read history from `schedule`.

## Swap UI

Click any slot → modal listing recipes with the **same `role`**, sorted by macro distance from
the current pick:

```
distance = |Δprotein| + |Δkcal| / 40      // ~1 g protein ≈ 40 kcal in weight
```

Each row shows the recipe name and its deltas (`+3 g P, −60 kcal`). Selecting one writes to the
schedule and recomputes day totals live. Reuse `recipeTotals` / `perServing` from
`src/lib/nutrition.js` — no new nutrition math.

## Data model

`schedule` already exists as a top-level key in `recipes.json` (currently `{}`). Each slot holds
an **array** so a plate can be main + side + bread:

```json
"schedule": {
  "2026-09-04": {
    "breakfast": ["protein-smoothie"],
    "lunch":     ["moong-dal-chilla", "chhaas"],
    "dinner":    ["palak-paneer-light", "jowar-rotla"],
    "filler":    ["fairlife-nutrition-plan"]
  }
}
```

Writes go through the existing GitHub Contents API sync path like any other edit.

## Out of scope — deliberately

- **Vruddhi's calorie deficit / per-person portion scaling.** Same plan for both; portions are
  adjusted at Cronometer logging time. Putting this in the app roughly doubles its complexity
  for something handled in seconds outside it.
- **Calorie targeting.** Protein is the objective; calories are informational only.
- **Leftovers / batch-cooking carried across days.** Real complexity, no clear payoff yet.
- **Grocery list generation from the schedule.** Separate feature, later.

## Build order

1. **Tagging pass** — add `role` to all recipes, add the Fairlife drink, audit `breakfast` for
   misfiled mains. Data only, no code. *This is the blocker; do it first.*
2. **`src/lib/scheduler.js`** — `buildDay()` as a pure function, with unit tests over the real
   `recipes.json`. Verify it never hard-fails and respects the 20 g floor.
3. **Day view + one-click button** — render the four slots and day totals.
4. **Swap modal** — same-role list sorted by macro distance.

Steps 2–4 are each small. Step 1 is the one that takes real time, and nothing works without it.
