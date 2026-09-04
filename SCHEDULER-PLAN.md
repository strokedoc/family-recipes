# One-click day scheduler — implementation plan

Status: **implemented.** Written 2026-09-03; updated 2026-09-04. Read alongside
[AGENTS.md](AGENTS.md).

## What it does

One button fills a day with recipes that hit the household protein target while keeping the
other macros sensible. Breakfast is always the protein smoothie. Lunch and dinner are picked
from protein-anchor mains. A flexible "protein filler" slot absorbs whatever protein is left
over, choosing the cheapest option in calories that closes the gap.

Any slot can then be clicked to swap it for something with similar macros.

**Shared baseline: Vruddhi's current 1,500 kcal / 128 g Cronometer goal.** The builder actively
aims for 120 g protein and treats 110–128 g as a useful range. Harsh adds calories at logging time,
outside the shared plan.

## Why this is a small feature

The constants do most of the work. The highest-protein daily smoothie is ~49 g protein. Once lunch
and dinner each clear a 20 g floor, the day is already at ~89 g and the filler only has to close a small
residual. There is no optimisation problem here — it is "pick two mains above a floor, then pick
the filler that closes the gap." No solver, no dependency.

## Library shape — **tagging pass DONE 2026-09-03**

`category` alone was too coarse: `lunch-dinner` mixed protein mains, sides and breads, so a naive
picker would have scheduled Jowar rotla (6 g protein) as dinner. Every recipe now carries a
`role`, and `breakfast` has been collapsed to the smoothie slot only (per Harsh — everything else
is lunch, side, dinner or snack).

| role | meaning | count | scheduler use |
|---|---|---|---|
| `constant` | fixed daily item | 3 | breakfast slot |
| `main` | carries the meal's protein | 15 | lunch/dinner slots |
| `side` | vegetable/gravy/raita accompaniment | 6 | optional on a plate |
| `bread` | roti, thepla, rotla, paratha | 6 | optional on a plate |
| `filler` | drink/bowl used to top up protein | 10 | snack slot |
| `dessert` | — | 2 | ignored |

`proteinSource` (`paneer | tofu | dal | soya | besan | chickpea`) is set on all 15 mains, used
only to stop lunch and dinner both coming back paneer.

**The 20 g floor is a per-plate check, not per-recipe.** Only 9 of 15 mains clear 20 g on their
own; the other 6 (gatte 19.5, soya-keema 17.8, poha 17.0, toor-dal 16.5, tofu-bhurji 16.4,
chole 11.4) qualify when paired with a side. A per-recipe floor would have cut the main pool by
40% for no good reason.

`fairlife-drink` added (`role: filler`, ~150 kcal / 30 g protein per bottle). **Its numbers are
pencilled from the standard label and still need verifying against the actual bottle.**

### Feasibility check (run against the tagged library)

A seeded 5,000-day run against the current library produced **120.5–127.9 g protein** (122.8 g
average), with no warnings. Calories averaged 1,436; 13 of 5,000 plans landed slightly above the
soft 1,500-calorie mark, with a maximum of 1,531. This keeps the picker reliable while strongly
preferring days that fit Vruddhi's baseline.

## Scheduler algorithm

Pure function, no UI. `buildDay(data, date, opts) -> { slots, totals, warnings }`.

```
1. breakfast  = the `constant` recipe (protein smoothie).       ~44 g P
2. lunchMain  = pick from role=main, not used in last 7 days.
3. dinnerMain = same, different recipe, prefer a different proteinSource.
4. Assembled-plate floor: each of lunch and dinner must reach >= 20 g protein.
   If a main falls short, attach a side until the plate clears 20 g,
   or reject that main and pick another.
5. gap = 120 - (breakfast + lunch + dinner) protein.
6. filler = the LOWEST-CALORIE role=filler item whose protein >= gap.
   gap <= 2 g  -> nothing.
   no single filler closes the gap -> take the highest-protein one, warn.
7. Validate total protein in [110, 128]. Among valid attempts, prefer the day nearest the calorie
   target without crossing the net-carb and fat ceilings. If protein is outside range, relax the
   variety lookback and retry, then RETURN THE BEST ATTEMPT WITH A WARNING.
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
    "snack":     ["fairlife-nutrition-plan"]
  }
}
```

Writes go through the existing GitHub Contents API sync path like any other edit.

## Out of scope — deliberately

- **Per-person portion scaling.** The shared plan uses Vruddhi's baseline; Harsh adds his surplus
  at Cronometer logging time. Putting two profiles in the app would roughly double its complexity.
- **Hard calorie enforcement.** Protein determines validity; calories and the other macros rank
  valid choices without making the builder fail.
- **Leftovers / batch-cooking carried across days.** Real complexity, no clear payoff yet.

## Build order

1. ~~**Tagging pass** — `role` on all recipes, add the Fairlife drink, collapse `breakfast`.~~
   **Done 2026-09-03.**
2. ~~**`src/lib/scheduler.js`** — `buildDay()`, `dayTotals()`, `dayBars()`, `swapOptions()`.~~
   **Done.** A seeded 1,000-day regression test verifies the 110–128 g range, 120 g active aim,
   plate floors, protein-source variety, and warning-free generation.
3. ~~**Day view + one-click button**~~ **Done.** Per-day `✨ Fill` / `↻ Rebuild`, plus
   `✨ Fill empty days` for the whole week. A day is written as one `setDay` op, not four.
4. ~~**Swap modal**~~ **Done.** Tap any chip → same-role list, closest macros first, with
   `+g P` / `kcal` deltas.

Also landed: schedule slots now hold **an array** of recipe ids (a plate = main + side kick),
read through `slotIds()` and backward-compatible with the old single-id shape — no migration.

## Open questions for Harsh

- **Verify the Fairlife label** (currently pencilled at 150 kcal / 30 g protein / 340 g bottle).
- **Breakfast swap-ins:** `protein-smoothie`, `protein-smoothie-loaded`, and `smoothie-dragon` are
  tagged `constant`. Say the word if anything else belongs in that slot.
