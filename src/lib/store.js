// Data store + sync engine.
//
// Reads: relative fetch of data/recipes.json (works offline via the service
// worker), then the GitHub API when configured (freshest copy + sha).
//
// Writes: every edit is a recipe-level *operation* pushed to a localStorage
// queue and applied optimistically to local state. Flushing re-fetches head,
// replays the queue onto the fresh content, and PUTs with the head sha.
// Replaying ops onto head IS the recipe-level merge from the spec: ops on
// different ids merge cleanly, same id = last write wins. Nothing is lost
// silently — the queue survives until a PUT succeeds.

import { fetchLatest, putData } from './github.js'

const SETTINGS_KEY = 'rasoi.settings'
const QUEUE_KEY = 'rasoi.queue'

export function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}
  } catch {
    return {}
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []
  } catch {
    return []
  }
}

export function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

// ---- operations ----

export function applyOp(data, op) {
  const next = {
    ...data,
    ingredients: { ...data.ingredients },
    recipes: [...data.recipes],
  }
  if (op.type === 'putRecipe') {
    const recipe = { ...op.recipe, updatedAt: op.at }
    const i = next.recipes.findIndex((r) => r.id === recipe.id)
    if (i >= 0) next.recipes[i] = recipe
    else next.recipes.push(recipe)
  } else if (op.type === 'deleteRecipe') {
    next.recipes = next.recipes.filter((r) => r.id !== op.id)
  } else if (op.type === 'putIngredient') {
    next.ingredients[op.key] = op.ingredient
  } else if (op.type === 'deleteIngredient') {
    // Safety net at apply time too: never orphan a recipe reference.
    const used = next.recipes.some((r) => r.ingredients.some((i) => i.ref === op.key))
    if (!used) delete next.ingredients[op.key]
  }
  return next
}

export function opMessage(op) {
  if (op.type === 'putRecipe') return `Update ${op.recipe.id} via app`
  if (op.type === 'deleteRecipe') return `Delete ${op.id} via app`
  if (op.type === 'putIngredient') return `Update ingredient ${op.key} via app`
  if (op.type === 'deleteIngredient') return `Delete ingredient ${op.key} via app`
  return 'Update recipes via app'
}

// ---- reads ----

export async function fetchLocalData() {
  const res = await fetch(`data/recipes.json?t=${Date.now()}`)
  if (!res.ok) throw new Error('Could not load recipe data')
  return res.json()
}

export async function fetchProfiles() {
  try {
    const res = await fetch('data/profiles.json')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ---- sync ----

// Flush the queue: replay onto fresh head, PUT, retry on write race.
// The queue is re-read every attempt, and only the ops actually flushed are
// removed afterwards (commit() may append mid-flight — those must survive).
export async function flushQueue(settings) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const queue = loadQueue()
    if (!queue.length) return { flushed: 0, conflicts: [] }
    const { data: head, sha } = await fetchLatest(settings)
    // Spec: same-id concurrent edit = last-write-wins WITH a toast. Detect it
    // by comparing head's updatedAt against what this phone based its edit on.
    const conflicts = []
    for (const op of queue) {
      if (op.type !== 'putRecipe' || !op.baseUpdatedAt) continue
      // No head copy at all means it was deleted remotely — our edit restores
      // it (LWW), which deserves a toast just as much as an overwrite does.
      const theirs = head.recipes.find((r) => r.id === op.recipe.id)
      if (!theirs || theirs.updatedAt !== op.baseUpdatedAt) conflicts.push(op.recipe.name)
    }
    let merged = head
    for (const op of queue) merged = applyOp(merged, op)
    const message =
      queue.length === 1 ? opMessage(queue[0]) : `Update ${queue.length} items via app`
    try {
      const { sha: newSha } = await putData(settings, merged, sha, message)
      saveQueue(loadQueue().slice(queue.length))
      return { flushed: queue.length, data: merged, sha: newSha, conflicts }
    } catch (e) {
      if (!e.conflict) throw e
      // someone else committed between our read and write — loop re-fetches
    }
  }
  throw new Error('Sync conflict persisted after retries — edits kept in queue')
}
