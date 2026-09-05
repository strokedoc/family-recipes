// Regression checks for the meal planner's nutrition and fallback behavior.
import { readFileSync } from 'node:fs'
import { buildDay, dayBars, DAILY_TARGET, PLATE_MIN_PROTEIN } from '../src/lib/scheduler.js'
import { balanceRecipes } from '../src/lib/balancer.js'
import { perServing } from '../src/lib/nutrition.js'
import { applyOp } from '../src/lib/store.js'
import { autoFillWeek, MEALS, slotIds } from '../src/lib/planner.js'

const data = JSON.parse(readFileSync(new URL('../public/data/recipes.json', import.meta.url)))
let failures = 0
const check = (label, condition) => {
  console.log(`${label}: ${condition ? 'PASS' : 'FAIL'}`)
  if (!condition) failures++
}

// Seed randomness so a regression produces the same failing sequence locally and in CI.
let seed = 20260904
const realRandom = Math.random
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

const proteinResults = []
let validPlates = true
let distinctSources = true
let noRepeatWithinDay = true
let warned = false
for (let i = 0; i < 1000; i++) {
  const result = buildDay(data, '2026-09-04')
  proteinResults.push(result.totals.protein)
  warned ||= result.warnings.length > 0
  for (const meal of ['lunch', 'dinner']) {
    const recipes = result.slots[meal].map((id) => data.recipes.find((r) => r.id === id))
    const protein = recipes.reduce((total, recipe) => {
      return total + perServing(recipe, data.ingredients).protein
    }, 0)
    validPlates &&= protein >= PLATE_MIN_PROTEIN
  }
  const lunchMain = result.slots.lunch
    .map((id) => data.recipes.find((r) => r.id === id))
    .find((r) => r.role === 'main')
  const dinnerMain = result.slots.dinner
    .map((id) => data.recipes.find((r) => r.id === id))
    .find((r) => r.role === 'main')
  distinctSources &&= lunchMain.proteinSource !== dinnerMain.proteinSource
  // Nothing is served twice in one day — a side kick at lunch must not come
  // back at dinner. Repeats across the week are fine.
  const dayIds = ['breakfast', 'lunch', 'dinner', 'snack'].flatMap((m) => result.slots[m])
  noRepeatWithinDay &&= new Set(dayIds).size === dayIds.length
}

check(
  'T1 generated protein stays in the useful range',
  proteinResults.every((p) => p >= DAILY_TARGET.proteinMin && p <= DAILY_TARGET.protein),
)
check('T1 generated days build toward 120 g', proteinResults.every((p) => p >= DAILY_TARGET.proteinAim))
check('T1 generated days need no warnings', !warned)
check('T1 lunch and dinner clear the plate floor', validPlates)
check('T1 lunch and dinner use different protein sources', distinctSources)
check('T1 no recipe is served twice in one day', noRepeatWithinDay)

const under = dayBars({ kcal: 0, protein: 109.9, carbs: 0, fat: 0, fiber: 0 })[0]
const good = dayBars({ kcal: 0, protein: 110, carbs: 0, fat: 0, fiber: 0 })[0]
const over = dayBars({ kcal: 0, protein: 129, carbs: 0, fat: 0, fiber: 0 })[0]
check('T2 protein bar uses 110 g as the good floor', !under.hit && good.hit)
check('T2 protein bar uses 128 g as the upper mark', !good.over && over.over)

// A strict seven-day variety pass can have two usable but underpowered mains.
// The planner must relax its lookback and find a valid day instead of returning
// that first miss.
const macro = (kcal, protein) => ({ kcal, protein, carbs: 0, fat: 0, fiber: 0 })
const ingredients = {
  breakfast: { per100g: macro(100, 40) },
  lowA: { per100g: macro(100, 20) },
  lowB: { per100g: macro(100, 20) },
  strongA: { per100g: macro(100, 30) },
  strongB: { per100g: macro(100, 30) },
  topup: { per100g: macro(100, 20) },
}
const recipe = (id, role, proteinSource) => ({
  id,
  role,
  proteinSource,
  servings: 1,
  ingredients: [{ ref: id, grams: 100 }],
})
const fallbackData = {
  ingredients,
  recipes: [
    recipe('breakfast', 'constant'),
    recipe('lowA', 'main', 'tofu'),
    recipe('lowB', 'main', 'dal'),
    recipe('strongA', 'main', 'paneer'),
    recipe('strongB', 'main', 'soya'),
    recipe('topup', 'filler'),
  ],
  schedule: {
    '2026-09-03': { lunch: ['strongA'], dinner: ['strongB'] },
  },
}
const relaxed = buildDay(fallbackData, '2026-09-04')
check(
  'T3 variety lookback relaxes when the fresh choices miss protein',
  relaxed.totals.protein >= DAILY_TARGET.proteinMin && relaxed.warnings.length === 0,
)

const scheduled = {
  ...data,
  schedule: {
    '2026-09-04': {
      lunch: ['chole', 'chhaas'],
      dinner: ['chole'],
    },
  },
}
const afterDelete = applyOp(scheduled, { type: 'deleteRecipe', id: 'chole' })
check(
  'T4 deleting a recipe removes its scheduled copies',
  JSON.stringify(afterDelete.schedule) ===
    JSON.stringify({ '2026-09-04': { lunch: ['chhaas'] } }),
)

const current = { kcal: 800, protein: 75, netCarbs: 70, fat: 25 }
const suggestions = balanceRecipes(data, current)
check('T5 macro balancer returns three ranked recipes', suggestions.length === 3)
check(
  'T5 macro balancer scores are ordered best first',
  suggestions.every((item, index) => index === 0 || suggestions[index - 1].score <= item.score),
)
check(
  'T5 projected totals include the suggested serving',
  suggestions.every(
    (item) =>
      Math.abs(item.after.kcal - current.kcal - item.macros.kcal) < 0.001 &&
      Math.abs(item.after.protein - current.protein - item.macros.protein) < 0.001,
  ),
)
const withoutBest = balanceRecipes(data, current, { excludeIds: [suggestions[0].recipe.id] })
check('T5 macro balancer can exclude an already-used recipe', withoutBest[0].recipe.id !== suggestions[0].recipe.id)
const nearlyFull = balanceRecipes(data, {
  kcal: 1400,
  protein: 110,
  netCarbs: 120,
  fat: 45,
})[0]
check(
  'T5 macro balancer respects a nearly-full calorie budget',
  nearlyFull.after.kcal <= DAILY_TARGET.kcal + 20 &&
    nearlyFull.after.protein >= DAILY_TARGET.proteinAim,
)

// T6 "Add specific" must not drop a recipe into a day that already serves it.
const weekStart = '2026-08-31'
const busyWeek = { ...data, schedule: {} }
for (let i = 0; i < 7; i++) {
  const d = `2026-0${i < 1 ? '8-31' : `9-0${i}`}`
  busyWeek.schedule[d] = { breakfast: ['x'], lunch: ['x'], dinner: ['x'], snack: ['x'] }
}
busyWeek.schedule['2026-09-01'].lunch = ['chhaas']
busyWeek.schedule['2026-09-01'].dinner = [] // the only empty slot in the week
check('T6 add-specific skips a day that already serves that recipe',
  autoFillWeek(busyWeek, weekStart, ['chhaas']).ops.length === 0)
check('T6 add-specific still places the other picks',
  autoFillWeek(busyWeek, weekStart, ['chhaas', 'cucumber-raita']).ops
    .every((op) => op.recipeId === 'cucumber-raita'))

// A whole week built day by day still holds the within-day rule.
let weekClean = true
const built = { ...data, schedule: {} }
for (let i = 0; i < 7; i++) {
  const d = `2026-0${i < 1 ? '8-31' : `9-0${i}`}`
  built.schedule[d] = buildDay(built, d).slots
  const ids = MEALS.flatMap((m) => slotIds(built.schedule[d][m]))
  weekClean &&= new Set(ids).size === ids.length
}
check('T6 a week built day by day repeats nothing within a day', weekClean)

Math.random = realRandom
process.exit(failures ? 1 : 0)
