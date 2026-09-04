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

Cronometer's branded database contains entries where the label's **per-serving** values were
entered on a **per-100 g** basis, and/or a named measure has a fabricated gram weight. Using one
silently multiplies that ingredient.

Before putting a food id into a recipe, check `get_food_details` and sanity-check two things:

- **The measures.** Does "1 cup" of a liquid weigh ~240 g? Does "1 tbsp" weigh ~15 g? A cup
  defined as 100 g is a red flag.
- **The per-100 g macros.** `get_food_details` returns values **per 100 g**. Skim milk is ~34 kcal,
  Greek yogurt ~59, nut butter ~550–600, whey ~400. If a food reads like its label panel
  (80 kcal / 8 g protein for milk), the entry is per-serving and must not be used.

**Known-bad entries — do not use:**

| Food | id | Problem |
|---|---|---|
| Nature's Promise, Organic, Fat Free Milk | 75460528 | "Cup" = 100 g; per-100 g values are per-cup label values. 120 g logs as 1.2 cups instead of 0.5 cup. Use USDA id **168** (skim milk, 245 g/cup, 34 kcal/100 g) instead. |

## Never pass `serving_grams` to `add_recipe`

Let Cronometer compute the batch weight from the ingredients. If the `serving_grams` you declare
disagrees with Cronometer's own total, **every nutrient is scaled by the ratio** — a uniform,
easy-to-miss error. This happened on 2026-09-04: a declared 424.6 g against a 304.6 g batch
inflated the whole smoothie by 1.394×, reporting 741 kcal for a 476 kcal drink.

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
