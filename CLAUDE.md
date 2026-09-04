# CLAUDE.md — V's Kitchen

**Read [AGENTS.md](AGENTS.md) first.** It carries the shared baseline for every agent working on
this repo: what the project is, the data model, the working rules, ingredient standards, the
two-account Cronometer setup, and the push policy. Do not duplicate or restate those rules here.

This file adds Claude-specific rules that were learned the hard way. Each one exists because it
was violated and produced a wrong number in Harsh's diary.

## Cronometer: recipes, never custom foods

**Default to `add_recipe`. Never use `add_custom_food` to represent a dish.** A recipe references
real Cronometer foods by id and lets Cronometer derive the nutrition, including micronutrients. A
custom food is hand-typed macros — it is unverifiable, carries no micros, and silently encodes
whatever estimate the agent happened to make.

`add_custom_food` is allowed in exactly two cases:

1. **Mirroring** an existing food's nutrition from one account to the other (AGENTS.md case 1),
   where a nutrient snapshot is the whole point.
2. **A genuinely missing ingredient** — not in Cronometer's database at all. Then build it from a
   verified source (the product's own label, or USDA/NCCDB), say in your reply which source you
   used, and add the ingredient to `recipes.json` too. Never from memory or estimation.

If an ingredient is missing, add *the ingredient* and still build *the dish* as a recipe.

## Validate every Cronometer food entry before you use it

Some Cronometer entries do not express quantities in real grams. Their nutrition per serving is
correct, but the gram scale underneath it is not physical — so passing a real gram weight
silently multiplies that ingredient.

Before putting a food id into a recipe, call `get_food_details` and check the **unit scale**, not
just the macros:

- **Derive the implied density from the small measures.** For a liquid, `ml` should be ~1 g and
  `tbsp` ~15 g; for milk specifically ~1.03 g/ml. If `ml` comes back as 0.42 g, the entry's "gram"
  is not a gram and gram-based quantities will be wrong by that factor.
- **Cross-check the measures against each other.** They should be internally consistent with a
  real density (cup ≈ 240 ml ≈ 245 g for milk, L ≈ 1030 g).
- **Sanity-check per-100 g macros.** `get_food_details` returns values per 100 g. Skim milk ~34 kcal,
  Greek yogurt ~59, nut butter ~550–600, whey ~400. A milk entry reading 80 kcal / 8 g protein per
  100 g is reporting a per-cup label panel on a rescaled basis.

**Entries with a non-gram scale:**

| Food | id | Problem |
|---|---|---|
| Nature's Promise, Organic, Fat Free Milk | 75460528 | Its cup is **240 ml** (correct), but the entry's gram unit is rescaled to ~0.417 per ml, so 100 units = 1 cup and per-100-unit nutrition = one cup's label (80 kcal / 8 g protein). Its per-cup nutrition is fine; only **gram** quantities are wrong, over-counting ~2.4×. Passing 120 g logged 1.2 cups instead of 0.5 cup. Either log it by the Cup measure, or use USDA id **168** (skim milk, true grams, 245 g/cup, 34 kcal/100 g). |

## Never pass `serving_grams` to `add_recipe`

Let Cronometer compute the batch weight from the ingredients. Declaring your own `serving_grams`
risks a uniform, easy-to-miss scaling of **every** nutrient.

Observed on 2026-09-04: a recipe built with `serving_grams=424.6` came back with all six macros
inflated by the same factor, 1.394× — 741 kcal for what is really a 476 kcal drink. The uniform
ratio (fiber included, where the suspect ingredient contributes none) proves it was a
weight/serving problem rather than one bad ingredient. `[unverified]` The specific cause was most
likely Cronometer computing a smaller batch weight than the declared one, but that was inferred
from the ratio, not measured — do not repeat it as established fact. The rule holds regardless of
mechanism, and the verify step below catches it either way.

To log it: use the `food_id` and `measure_id` returned by `add_recipe`, with `grams` equal to the
returned `total_grams` (one full batch).

## Predict, then verify every write-back

After any Cronometer write, **read the day back** (`get_daily_nutrition`) and reconcile it against
the number computed independently from `per100g` × grams. State the prediction before you read.

- If they agree, report the Cronometer figure — it is the source of truth for the diary.
- If they disagree, **stop and find the mechanism.** Do not report either number, and do not
  explain the gap away. A uniform ratio across all nutrients means a weight/serving problem; one
  nutrient off means a bad ingredient entry.

Never present a macro figure to Harsh that you have not reconciled this way.

## Recipe iteration

When a recipe changes, update the existing entry in `recipes.json` in place rather than
accumulating near-duplicates. Cronometer has no recipe-edit tool, so a changed recipe means a new
Cronometer recipe — name it `v2`, `v3`, … , say clearly in your reply which ids are superseded, and
remove the superseded **diary entries** yourself (`remove_food_entry`). Deleting the orphaned
custom foods/recipes is manual; list the ids for Harsh rather than leaving him to find them.
