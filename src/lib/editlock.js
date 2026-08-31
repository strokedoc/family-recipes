// Soft edit gate: a shared PIN that must be entered once per device before the
// app will add / change / delete recipes or ingredients. Once unlocked it stays
// unlocked in this browser's storage until someone taps "Lock editing" in
// Settings (or clears site data).
//
// This is a guard rail against accidental edits on our own phones — NOT
// security. The recipe data is a public file on GitHub; anyone with the link
// can read it, and a determined person could edit via GitHub directly. To
// change the PIN, edit EDIT_PIN below and redeploy.

export const EDIT_PIN = '2314'

const KEY = 'vk.editUnlock'

// Op types that require the PIN. Meal-schedule and grocery-list edits are
// per-device planning and stay ungated.
export const GATED_OPS = new Set([
  'putRecipe',
  'deleteRecipe',
  'putIngredient',
  'deleteIngredient',
])

export function isUnlocked() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function unlock() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* private mode — stays locked, PIN asked each time */
  }
}

export function lock() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
