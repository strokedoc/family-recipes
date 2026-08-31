// Weekly meal schedule + grocery-list derivation.
// Schedule lives as data.schedule[date][meal] = recipeId (date = YYYY-MM-DD, Monday-start weeks).
// Grocery adjustments (checked-off / extra items) live per week in data.groceryLists[weekStart].

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
export const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

function pad(n) {
  return String(n).padStart(2, '0')
}

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromISODate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso, n) {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

// Monday-start week containing `iso` (today if omitted).
export function weekStartOf(iso) {
  const d = iso ? fromISODate(iso) : new Date()
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISODate(d)
}

export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function dayLabel(iso) {
  const d = fromISODate(iso)
  return { weekday: DAY_NAMES[d.getDay()], date: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}` }
}

export function weekRangeLabel(weekStart) {
  const start = fromISODate(weekStart)
  const end = fromISODate(addDays(weekStart, 6))
  const sameMonth = start.getMonth() === end.getMonth()
  const startStr = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}`
  const endStr = sameMonth ? `${end.getDate()}` : `${MONTH_NAMES[end.getMonth()]} ${end.getDate()}`
  return `${startStr}–${endStr}`
}

export function isToday(iso) {
  return iso === toISODate(new Date())
}

// Aggregate grams of every "fresh" ingredient across all recipes scheduled in
// the given week, merged with that week's manual check-offs and extra items.
// A recipe scheduled for a meal is assumed cooked once, whole batch — its
// ingredient grams (not per-serving) count toward the total.
export function buildGroceryList(data, weekStart) {
  const totals = {} // ref -> grams
  for (const date of weekDates(weekStart)) {
    const day = data.schedule?.[date]
    if (!day) continue
    for (const meal of MEALS) {
      const recipeId = day[meal]
      if (!recipeId) continue
      const recipe = data.recipes.find((r) => r.id === recipeId)
      if (!recipe) continue
      for (const item of recipe.ingredients) {
        const ing = data.ingredients[item.ref]
        if (!ing?.fresh) continue
        totals[item.ref] = (totals[item.ref] || 0) + item.grams
      }
    }
  }
  const saved = data.groceryLists?.[weekStart] || {}
  const checkedRefs = saved.checkedRefs || []
  const items = Object.entries(totals)
    .map(([ref, grams]) => ({
      ref,
      name: data.ingredients[ref]?.name || ref,
      grams,
      checked: checkedRefs.includes(ref),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const extra = (saved.extra || []).slice()
  return { items, extra }
}
