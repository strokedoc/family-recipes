// Rank one-serving recipes against Vruddhi's shared-plan baseline using macros
// already consumed today. This is advisory only; entered totals stay on-device.

import { perServing, proteinDensity } from './nutrition.js'
import { DAILY_TARGET } from './scheduler.js'

const number = (value) => Math.max(0, Number(value) || 0)

export function balanceRecipes(data, current, opts = {}) {
  const target = opts.target || DAILY_TARGET
  const exclude = new Set(opts.excludeIds || [])
  const limit = opts.limit ?? 3
  const now = {
    kcal: number(current.kcal),
    protein: number(current.protein),
    netCarbs: number(current.netCarbs),
    fat: number(current.fat),
  }
  const proteinAim = target.proteinAim ?? target.protein
  const startingProteinGap = Math.max(1, proteinAim - now.protein)
  const startingKcalGap = Math.max(1, target.kcal - now.kcal)

  return data.recipes
    .filter((recipe) => !exclude.has(recipe.id))
    .map((recipe) => {
      const macros = perServing(recipe, data.ingredients)
      const netCarbs = Math.max(0, macros.carbs - macros.fiber)
      const after = {
        kcal: now.kcal + macros.kcal,
        protein: now.protein + macros.protein,
        netCarbs: now.netCarbs + netCarbs,
        fat: now.fat + macros.fat,
      }

      // First close the protein gap, then the calorie gap. Going past a target
      // costs substantially more than merely leaving room for another food, so
      // a dense protein option wins over a large meal that unbalances the day.
      const proteinShort = Math.max(0, proteinAim - after.protein) / startingProteinGap
      const kcalShort = Math.max(0, target.kcal - after.kcal) / startingKcalGap
      const proteinOver = Math.max(0, after.protein - target.protein) / target.protein
      const kcalOver = Math.max(0, after.kcal - target.kcal) / target.kcal
      const carbsOver = Math.max(0, after.netCarbs - target.netCarbs) / target.netCarbs
      const fatOver = Math.max(0, after.fat - target.fat) / target.fat
      const score =
        proteinShort * 6 +
        kcalShort * 0.75 +
        proteinOver +
        kcalOver * 12 +
        carbsOver * 3 +
        fatOver * 3

      return { recipe, macros, netCarbs, after, score, density: proteinDensity(macros) }
    })
    .sort((a, b) => a.score - b.score || b.density - a.density)
    .slice(0, limit)
}
