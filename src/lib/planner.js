// Weekly meal schedule + grocery-list derivation.
// Schedule lives as data.schedule[date][meal] (date = YYYY-MM-DD, Monday-start weeks).
// A slot holds either a single recipeId (legacy) or an array of them, so a meal
// can be a plate — a main plus a side kick. Always read slots through slotIds().
// Grocery adjustments (checked-off / extra items) live per week in data.groceryLists[weekStart].

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']

// Normalise a slot to an array. Accepts a string, an array, null or undefined.
export function slotIds(slot) {
  if (!slot) return []
  return (Array.isArray(slot) ? slot : [slot]).filter(Boolean)
}
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

// Fisher–Yates shuffle (returns a new array).
function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Meal slots each recipe category is a natural fit for.
const CATEGORY_MEALS = {
  breakfast: ['breakfast'],
  'lunch-dinner': ['lunch', 'dinner'],
  snack: ['snack'],
  dessert: ['snack'],
}

// Randomly drop recipeIds into EMPTY meal slots of the given week, preferring
// slots that match each recipe's category, then falling back to any empty slot.
// Existing entries are never overwritten. Returns { ops, placed, skipped }.
export function autoFillWeek(data, weekStart, recipeIds) {
  const schedule = data.schedule || {}
  const emptyByMeal = Object.fromEntries(MEALS.map((m) => [m, []]))
  for (const date of weekDates(weekStart)) {
    const day = schedule[date] || {}
    for (const meal of MEALS) if (!slotIds(day[meal]).length) emptyByMeal[meal].push({ date, meal })
  }
  for (const meal of MEALS) emptyByMeal[meal] = shuffle(emptyByMeal[meal])
  const anyEmpty = shuffle(MEALS.flatMap((m) => emptyByMeal[m]))

  const taken = new Set()
  const free = (s) => s && !taken.has(`${s.date}|${s.meal}`)
  const ops = []
  for (const id of shuffle(recipeIds)) {
    const recipe = data.recipes.find((r) => r.id === id)
    const prefer = CATEGORY_MEALS[recipe?.category] || []
    const slot =
      prefer.flatMap((m) => emptyByMeal[m]).find(free) || anyEmpty.find(free)
    if (!slot) break
    taken.add(`${slot.date}|${slot.meal}`)
    ops.push({ date: slot.date, meal: slot.meal, recipeId: id })
  }
  return { ops, placed: ops.length, skipped: recipeIds.length - ops.length }
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
      for (const recipeId of slotIds(day[meal])) {
        const recipe = data.recipes.find((r) => r.id === recipeId)
        if (!recipe) continue
        for (const item of recipe.ingredients) {
          const ing = data.ingredients[item.ref]
          if (!ing?.fresh) continue
          totals[item.ref] = (totals[item.ref] || 0) + item.grams
        }
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
