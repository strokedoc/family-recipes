// Regression harness for the sync engine (src/lib/store.js) against a fake
// GitHub Contents API. Run: node scripts/test-sync.mjs   (exit 0 = all pass)
// Covers the data-loss scenarios found in the 2026-08-30 adversarial review:
// mid-flight commits, 409 write races, and same-recipe concurrent edits.
import { readFileSync } from 'fs'

// ---- shims ----
const ls = new Map()
globalThis.localStorage = {
  getItem: (k) => (ls.has(k) ? ls.get(k) : null),
  setItem: (k, v) => ls.set(k, v),
  removeItem: (k) => ls.delete(k),
}

const seed = JSON.parse(readFileSync(new URL('../public/data/recipes.json', import.meta.url)))
let remote = { data: JSON.parse(JSON.stringify(seed)), sha: 'sha-1' }
let shaCounter = 1
let onFetchHead = null // hook: runs during the head fetch, to inject mid-flight events
let failFirstPut = false

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')
globalThis.fetch = async (url, opts = {}) => {
  if (!opts.method) {
    if (onFetchHead) {
      const f = onFetchHead
      onFetchHead = null
      await f()
    }
    return {
      ok: true,
      json: async () => ({ content: b64(JSON.stringify(remote.data)), sha: remote.sha }),
    }
  }
  const body = JSON.parse(opts.body)
  if (failFirstPut) {
    failFirstPut = false
    return { ok: false, status: 409, json: async () => ({}) }
  }
  if (body.sha !== remote.sha) return { ok: false, status: 409, json: async () => ({}) }
  remote = {
    data: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')),
    sha: 'sha-' + ++shaCounter,
  }
  return { ok: true, status: 200, json: async () => ({ content: { sha: remote.sha } }) }
}

const { flushQueue, loadQueue, saveQueue } = await import('../src/lib/store.js')
const settings = { repo: 'x/y', token: 't' }
const baseOf = (id) => seed.recipes.find((r) => r.id === id).updatedAt
const opFor = (id, name, base) => ({
  type: 'putRecipe',
  at: 'T-new',
  baseUpdatedAt: base,
  recipe: { ...seed.recipes.find((r) => r.id === id), name },
})

let failures = 0
const check = (label, cond) => {
  console.log(label + ':', cond ? 'PASS' : 'FAIL')
  if (!cond) failures++
}

// T1: an op committed while a flush's network call is in flight must survive
saveQueue([opFor('soya-keema', 'keema-edit', baseOf('soya-keema'))])
onFetchHead = async () => {
  const q = loadQueue()
  q.push(opFor('chole', 'chole-edit', baseOf('chole')))
  saveQueue(q)
}
let res = await flushQueue(settings)
let remaining = loadQueue()
check('T1 flushed only snapshot', res.flushed === 1)
check('T1 mid-flight op survives', remaining.length === 1 && remaining[0].recipe.name === 'chole-edit')
check(
  'T1 remote has keema edit only',
  remote.data.recipes.find((r) => r.id === 'soya-keema').name === 'keema-edit' &&
    remote.data.recipes.find((r) => r.id === 'chole').name !== 'chole-edit',
)
check('T1 no false conflict', res.conflicts.length === 0)
res = await flushQueue(settings)
check(
  'T1b leftover drains on next flush',
  res.flushed === 1 &&
    loadQueue().length === 0 &&
    remote.data.recipes.find((r) => r.id === 'chole').name === 'chole-edit',
)

// T2: 409 write race retries with a re-read queue and succeeds
failFirstPut = true
saveQueue([opFor('paneer-bhurji', 'bhurji-edit', baseOf('paneer-bhurji'))])
res = await flushQueue(settings)
check(
  'T2 conflict retry succeeds',
  res.flushed === 1 &&
    loadQueue().length === 0 &&
    remote.data.recipes.find((r) => r.id === 'paneer-bhurji').name === 'bhurji-edit',
)

// T3: same-recipe concurrent edit → last-write-wins, conflict reported
remote.data.recipes = remote.data.recipes.map((r) =>
  r.id === 'chole' ? { ...r, name: 'their-chole', updatedAt: 'T-theirs' } : r,
)
remote.sha = 'sha-' + ++shaCounter
saveQueue([opFor('chole', 'my-chole', baseOf('chole'))]) // based on the OLD version
res = await flushQueue(settings)
check('T3 LWW applied', remote.data.recipes.find((r) => r.id === 'chole').name === 'my-chole')
check('T3 conflict surfaced', res.conflicts.length === 1 && res.conflicts[0] === 'my-chole')

// T4: recipe deleted remotely while an edit to it is queued → edit restores it, conflict surfaced
remote.data.recipes = remote.data.recipes.filter((r) => r.id !== 'palak-paneer')
remote.sha = 'sha-' + ++shaCounter
saveQueue([opFor('palak-paneer', 'restored-palak', baseOf('palak-paneer'))])
res = await flushQueue(settings)
check(
  'T4 remote-delete restore surfaced',
  res.conflicts.length === 1 &&
    remote.data.recipes.find((r) => r.id === 'palak-paneer')?.name === 'restored-palak',
)

process.exit(failures ? 1 : 0)
