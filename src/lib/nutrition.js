// All nutrition is computed from the ingredient library — never stored per-recipe.

const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber']

export function recipeTotals(recipe, ingredients) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  for (const item of recipe.ingredients) {
    const ing = ingredients[item.ref]
    if (!ing) continue
    for (const m of MACROS) t[m] += (item.grams * (ing.per100g[m] || 0)) / 100
  }
  return t
}

export function perServing(recipe, ingredients) {
  const t = recipeTotals(recipe, ingredients)
  const s = recipe.servings || 1
  const out = {}
  for (const m of MACROS) out[m] = t[m] / s
  return out
}

// Macros for `grams` of the cooked dish. Requires yieldGramsCooked.
export function perGrams(recipe, ingredients, grams) {
  if (!recipe.yieldGramsCooked) return null
  const t = recipeTotals(recipe, ingredients)
  const out = {}
  for (const m of MACROS) out[m] = (t[m] * grams) / recipe.yieldGramsCooked
  return out
}

// How this household ranks food: grams of protein per 100 kcal.
export function proteinDensity(macros) {
  if (!macros.kcal) return 0
  return (macros.protein / macros.kcal) * 100
}

export function fmt(n, digits = 0) {
  const v = Number(n)
  if (!isFinite(v)) return '–'
  return v.toFixed(digits).replace(/\.0$/, '')
}

// "Soya keema, 180 g — 210 kcal, P15/C18/F6" (spec format, for Cronometer paste)
export function cronometerLine(name, grams, macros) {
  const qty = grams ? `${fmt(grams)} g` : '1 serving'
  return `${name}, ${qty} — ${fmt(macros.kcal)} kcal, P${fmt(macros.protein)}/C${fmt(macros.carbs)}/F${fmt(macros.fat)}`
}

// Recipes referencing an ingredient key (used to block library deletes).
export function recipesUsing(data, ref) {
  return data.recipes.filter((r) => r.ingredients.some((i) => i.ref === ref))
}
