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

## Library shape — **tagging pass DONE 2026-09-03**

`category` alone was too coarse: `lunch-dinner` mixed protein mains, sides and breads, so a naive
picker would have scheduled Jowar rotla (6 g protein) as dinner. Every recipe now carries a
`role`, and `breakfast` has been collapsed to the smoothie slot only (per Harsh — everything else
is lunch, side, dinner or snack).

| role | meaning | count | scheduler use |
|---|---|---|---|
| `constant` | fixed daily item | 2 | breakfast slot |
| `main` | carries the meal's protein | 15 | lunch/dinner slots |
| `side` | vegetable/gravy/raita accompaniment | 6 | optional on a plate |
| `bread` | roti, thepla, rotla, paratha | 6 | optional on a plate |
| `filler` | drink/bowl used to top up protein | 9 | filler slot |
| `dessert` | — | 3 | ignored |

`proteinSource` (`paneer | tofu | dal | soya | besan | chickpea`) is set on all 15 mains, used
only to stop lunch and dinner both coming back paneer.

**The 20 g floor is a per-plate check, not per-recipe.** Only 9 of 15 mains clear 20 g on their
own; the other 6 (gatte 19.5, soya-keema 17.8, poha 17.0, toor-dal 16.5, tofu-bhurji 16.4,
chole 11.4) qualify when paired with a side. A per-recipe floor would have cut the main pool by
40% for no good reason.

`fairlife-drink` added (`role: filler`, ~150 kcal / 30 g protein per bottle). **Its numbers are
pencilled from the standard label and still need verifying against the actual bottle.**

### Feasibility check (run against the tagged library)

Enumerating every (lunch plate × dinner plate × filler) combination that respects the 20 g floor
and the different-proteinSource rule: **17,487 of 27,420 combinations land in the 100–130 g
protein window (64%).** The scheduler will effectively never fail to find a valid day, which is
what lets us keep it a simple picker with retries instead of a solver.

Leanest valid days come out around **980–1,040 kcal** at 100 g protein — comfortably under both
calorie targets, so portion sizes have room to move in either direction.

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

1. ~~**Tagging pass** — `role` on all recipes, add the Fairlife drink, collapse `breakfast`.~~
   **Done 2026-09-03.**
2. ~~**`src/lib/scheduler.js`** — `buildDay()`, `dayTotals()`, `dayBars()`, `swapOptions()`.~~
   **Done.** Verified over 400 generated days against the real library: 400/400 landed in the
   100–130 g window with no warnings, 0 plate-floor violations, 0 days repeating a protein
   source, 18 distinct recipes rotating through lunch + dinner.
3. ~~**Day view + one-click button**~~ **Done.** Per-day `✨ Fill` / `↻ Rebuild`, plus
   `✨ Fill empty days` for the whole week. A day is written as one `setDay` op, not four.
4. ~~**Swap modal**~~ **Done.** Tap any chip → same-role list, closest macros first, with
   `+g P` / `kcal` deltas.

Also landed: schedule slots now hold **an array** of recipe ids (a plate = main + side kick),
read through `slotIds()` and backward-compatible with the old single-id shape — no migration.

## Open questions for Harsh

- **Verify the Fairlife label** (currently pencilled at 150 kcal / 30 g protein / 340 g bottle).
- **Should desserts be usable as fillers?** `chocolate-yogurt-mousse` is 28.9 g protein for
  190 kcal — a better protein-per-calorie ratio than every filler except the Fairlife. It is
  tagged `dessert` and therefore invisible to the scheduler right now.
- **Breakfast swap-ins:** only `protein-smoothie` and `smoothie-dragon` are tagged `constant`.
  Say the word if anything else belongs in that slot.
