// One-click day builder. See SCHEDULER-PLAN.md.
//
// Protein is the ONLY hard constraint. Calories, net carbs and fat are reported
// and used to prefer a better-balanced valid day, but never enforced — hard
// macro bands make the button fail constantly.
// buildDay never throws and never returns nothing: a slightly-off day plus a
// warning always beats an error.

import { perServing } from './nutrition.js'

// Shared-plan baseline: Vruddhi's current Cronometer targets. Harsh adds his
// extra calories at logging time, outside the app. Deliberately unlabelled in
// the UI because both people eat the same planned meals.
export const DAILY_TARGET = {
  kcal: 1500,
  protein: 128, // current Cronometer goal / top of the preferred range
  proteinAim: 120, // what the builder actively tries to reach
  proteinMin: 110, // a sustainable day still counts as a hit here
  netCarbs: 135,
  fat: 50,
}

// A lunch or dinner plate must carry at least this much protein. Checked on the
// assembled plate, not the recipe — only 9 of 15 mains clear it alone, and the
// rest are fine once a side kick (raita, chhaas, kadhi) is alongside.
export const PLATE_MIN_PROTEIN = 20

export const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

const ZERO = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber']

function sum(a, b) {
  const out = {}
  for (const m of MACROS) out[m] = (a[m] || 0) + (b[m] || 0)
  return out
}

function pools(data) {
  const p = { constant: [], main: [], side: [], bread: [], filler: [], dessert: [] }
  for (const r of data.recipes) if (p[r.role]) p[r.role].push(r)
  return p
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function isoShift(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const p = (x) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

// Recipe ids scheduled in the `days` days before `date`. Used for variety only.
export function recentlyUsed(data, date, days) {
  const seen = new Set()
  for (let i = 1; i <= days; i++) {
    const day = data.schedule?.[isoShift(date, -i)]
    if (!day) continue
    for (const v of Object.values(day)) {
      for (const id of Array.isArray(v) ? v : [v]) if (id) seen.add(id)
    }
  }
  return seen
}

// The cheapest-in-calories candidate that supplies at least `gap` protein.
// If nothing closes the gap, fall back to the highest-protein candidate.
function cheapestThatCloses(candidates, gap, M) {
  if (!candidates.length) return null
  const closing = candidates.filter((r) => M(r).protein >= gap)
  if (closing.length) {
    return closing.reduce((best, r) => (M(r).kcal < M(best).kcal ? r : best))
  }
  return candidates.reduce((best, r) => (M(r).protein > M(best).protein ? r : best))
}

// Build one lunch/dinner plate: a main, plus a side kick if the main alone is
// short of the floor. Returns null if even the best side can't lift it.
function buildPlate(main, sides, M) {
  const p = M(main).protein
  if (p >= PLATE_MIN_PROTEIN) return [main]
  const kick = cheapestThatCloses(sides, PLATE_MIN_PROTEIN - p, M)
  if (!kick) return null
  if (p + M(kick).protein < PLATE_MIN_PROTEIN) return null
  return [main, kick]
}

function attempt(data, P, M, target, avoid) {
  const usable = (list) => {
    const fresh = list.filter((r) => !avoid.has(r.id))
    return fresh.length ? fresh : list
  }
  // Breakfast is a constant, not a lottery: always the highest-protein one
  // (the daily smoothie). Its lighter siblings stay available via swap.
  const breakfast = P.constant.reduce((best, r) => (M(r).protein > M(best).protein ? r : best))
  if (!breakfast) return null

  const mains = shuffle(usable(P.main))
  const sides = P.side
  let lunch = null
  let dinner = null
  for (const a of mains) {
    const pa = buildPlate(a, sides, M)
    if (!pa) continue
    for (const b of mains) {
      if (b.id === a.id) continue
      // Don't serve the same protein source twice in one day.
      if (a.proteinSource && a.proteinSource === b.proteinSource) continue
      const pb = buildPlate(b, sides, M)
      if (!pb) continue
      lunch = pa
      dinner = pb
      break
    }
    if (lunch) break
  }
  if (!lunch || !dinner) return null

  const eaten = [breakfast, ...lunch, ...dinner]
  const base = eaten.reduce((t, r) => sum(t, M(r)), ZERO)
  // Build toward the preferred intake, not merely the minimum acceptable day.
  // This keeps normal results near 120 g while still treating 110–128 g as a
  // useful, sustainable range rather than a pass/fail prescription.
  const gap = (target.proteinAim ?? target.protein) - base.protein
  const usedIds = new Set(eaten.map((r) => r.id))
  const fillers = P.filler.filter((r) => !usedIds.has(r.id))
  const filler = gap > 2 ? cheapestThatCloses(fillers, gap, M) : null

  const slots = {
    breakfast: [breakfast.id],
    lunch: lunch.map((r) => r.id),
    dinner: dinner.map((r) => r.id),
    snack: filler ? [filler.id] : [],
  }
  const totals = filler ? sum(base, M(filler)) : base
  return { slots, totals }
}

// How far a candidate day is from the protein window — lower is better.
function miss(totals, target) {
  if (totals.protein < target.proteinMin) return target.proteinMin - totals.protein
  if (totals.protein > target.protein) return totals.protein - target.protein
  return 0
}

// Protein decides whether a day is valid. Among valid days, prefer one near
// the shared calorie baseline and avoid going over the other macro ceilings.
// Going over calories costs more than leaving room because Harsh can add food;
// Vruddhi cannot subtract an oversized shared plan.
function softScore(totals, target) {
  const netCarbs = totals.carbs - totals.fiber
  const proteinDistance = Math.abs(totals.protein - (target.proteinAim ?? target.protein)) * 0.25
  const kcalUnder = Math.max(0, target.kcal - totals.kcal) / 100
  const kcalOver = Math.max(0, totals.kcal - target.kcal) / 20
  const carbsOver = Math.max(0, netCarbs - target.netCarbs) / 10
  const fatOver = Math.max(0, totals.fat - target.fat) / 5
  return proteinDistance + kcalUnder + kcalOver + carbsOver + fatOver
}

function better(a, b, target) {
  if (!b) return true
  const aMiss = miss(a.totals, target)
  const bMiss = miss(b.totals, target)
  return aMiss < bMiss || (aMiss === bMiss && softScore(a.totals, target) < softScore(b.totals, target))
}

/**
 * Fill one day. Returns { slots, totals, warnings } — always, never throws.
 * slots maps each meal to an array of recipe ids.
 */
export function buildDay(data, date, opts = {}) {
  const target = opts.target || DAILY_TARGET
  const M = (r) => perServing(r, data.ingredients)
  const P = pools(data)

  if (!P.constant.length || P.main.length < 2) {
    return {
      slots: { breakfast: [], lunch: [], dinner: [], snack: [] },
      totals: ZERO,
      warnings: ['Not enough tagged recipes to build a day — need a constant and 2+ mains.'],
    }
  }

  // Three passes: avoid the last 7 days, then the last 3, then allow anything.
  // Keep trying relaxed passes when a strict-variety pass only finds a miss.
  let best = null
  for (const days of [opts.lookbackDays ?? 7, 3, 0]) {
    const avoid = days ? recentlyUsed(data, date, days) : new Set()
    let passBest = null
    for (let i = 0; i < 25; i++) {
      const cand = attempt(data, P, M, target, avoid)
      if (!cand) continue
      if (better(cand, passBest, target)) passBest = cand
      if (better(cand, best, target)) best = cand
    }
    // Preserve the strongest available variety rule. Only relax lookback when
    // this pass cannot produce a protein-valid day at all.
    if (passBest && miss(passBest.totals, target) === 0) return { ...passBest, warnings: [] }
  }

  if (!best) {
    return {
      slots: { breakfast: [], lunch: [], dinner: [], snack: [] },
      totals: ZERO,
      warnings: ['Could not assemble a day — no two mains reach the 20 g plate floor.'],
    }
  }
  const p = Math.round(best.totals.protein)
  return {
    ...best,
    warnings: [
      p < target.proteinMin
        ? `Best available day is ${p} g protein — under the ${target.proteinMin} g floor.`
        : `Best available day is ${p} g protein — over the ${target.protein} g mark.`,
    ],
  }
}

// ---- day totals + the four bars ----

// Macros for a scheduled day. `day` is data.schedule[date] — each meal holds a
// recipe id or an array of them (both shapes are accepted).
export function dayTotals(data, day) {
  let t = ZERO
  for (const v of Object.values(day || {})) {
    for (const id of Array.isArray(v) ? v : [v]) {
      const r = id && data.recipes.find((x) => x.id === id)
      if (r) t = sum(t, perServing(r, data.ingredients))
    }
  }
  return t
}

/**
 * The four daily bars. Protein fills toward a target you want to REACH; the
 * other three are ceilings you'd rather not cross. Net carbs, not total —
 * fiber runs ~30 g/day here, so total carbs would read "over" on most days.
 */
export function dayBars(totals, target = DAILY_TARGET) {
  const netCarbs = totals.carbs - totals.fiber
  return [
    {
      key: 'protein',
      label: 'Protein',
      value: totals.protein,
      target: target.protein,
      unit: 'g',
      kind: 'reach',
      hit: totals.protein >= target.proteinMin,
      over: totals.protein > target.protein,
    },
    {
      key: 'kcal',
      label: 'Calories',
      value: totals.kcal,
      target: target.kcal,
      unit: '',
      kind: 'ceiling',
      over: totals.kcal > target.kcal,
    },
    {
      key: 'netCarbs',
      label: 'Net carbs',
      value: netCarbs,
      target: target.netCarbs,
      unit: 'g',
      kind: 'ceiling',
      over: netCarbs > target.netCarbs,
    },
    {
      key: 'fat',
      label: 'Fat',
      value: totals.fat,
      target: target.fat,
      unit: 'g',
      kind: 'ceiling',
      over: totals.fat > target.fat,
    },
  ]
}

// ---- swap ----

// Recipes interchangeable with `recipeId`, nearest macros first. Same role only,
// so a bread never gets offered in place of a main.
export function swapOptions(data, recipeId) {
  const cur = data.recipes.find((r) => r.id === recipeId)
  if (!cur) return []
  const M = (r) => perServing(r, data.ingredients)
  const c = M(cur)
  return data.recipes
    .filter((r) => r.role === cur.role && r.id !== cur.id)
    .map((r) => {
      const m = M(r)
      return {
        recipe: r,
        macros: m,
        dProtein: m.protein - c.protein,
        dKcal: m.kcal - c.kcal,
        // 1 g protein is worth about 40 kcal of attention here.
        distance: Math.abs(m.protein - c.protein) + Math.abs(m.kcal - c.kcal) / 40,
      }
    })
    .sort((a, b) => a.distance - b.distance)
}
