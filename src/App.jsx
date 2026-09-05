import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Browse from './views/Browse.jsx'
import Schedule from './views/Schedule.jsx'
import Grocery from './views/Grocery.jsx'
import Recipe from './views/Recipe.jsx'
import RecipeEdit from './views/RecipeEdit.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
import Icon from './components/Icon.jsx'
import { weekStartOf, weekRangeLabel } from './lib/planner.js'
import {
  loadSettings,
  saveSettings,
  loadQueue,
  saveQueue,
  applyOp,
  fetchLocalData,
  flushQueue,
} from './lib/store.js'
import { fetchLatest } from './lib/github.js'
import { EDIT_PIN, GATED_OPS, isUnlocked, unlock } from './lib/editlock.js'

// The four thumb-reachable routes, in swipe order. Settings sits outside it —
// it is reached from the header gear and returns the same way.
const DOCK_VIEWS = ['recipes', 'plan', 'shop', 'pantry']
const DOCK_LABELS = { recipes: 'Recipes', plan: 'Plan', shop: 'Shop', pantry: 'Pantry' }

export default function App() {
  const [nav, setNav] = useState({ view: 'recipes' })
  // The week is shared by Plan and Shop — the header names it for both, and
  // shopping for a week you aren't planning is never what you meant.
  const [weekStart, setWeekStart] = useState(() => weekStartOf())
  // Recipe sort lives here because the header eyebrow names it.
  const [sort, setSort] = useState('density')
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [pending, setPending] = useState(loadQueue().length)
  const [sync, setSync] = useState({ state: 'loading', detail: '' }) // loading | readonly | ok | pending | offline | error
  const [toast, setToast] = useState(null)
  const [pinOp, setPinOp] = useState(null) // op held back until the edit PIN is entered
  const flushing = useRef(false)
  const swipeX = useRef(null)
  const dataRef = useRef(null)
  dataRef.current = data

  const showToast = useCallback((msg) => {
    setToast(msg)
    window.clearTimeout(showToast.t)
    showToast.t = window.setTimeout(() => setToast(null), 3500)
  }, [])

  // Initial load: local file first (fast, offline-capable), then API for freshness.
  useEffect(() => {
    let alive = true
    fetchLocalData()
      .then((d) => {
        if (!alive) return
        // The bundled file is only the base copy. Reapply queued edits even
        // when no GitHub repo/token is configured so a refresh never appears
        // to discard changes that are still safely waiting on this device.
        let merged = d
        for (const op of loadQueue()) merged = applyOp(merged, op)
        setData((cur) => cur || merged)
      })
      .catch(() => alive && setSync({ state: 'error', detail: 'Could not load recipes' }))
    const s = loadSettings()
    if (s.repo) {
      fetchLatest(s)
        .then(({ data: d }) => {
          if (!alive) return
          // Re-apply any queued local edits on top of the fresh copy.
          const queued = loadQueue()
          let merged = d
          for (const op of queued) merged = applyOp(merged, op)
          setData(merged)
          const idle = s.token ? 'ok' : 'readonly'
          setSync({ state: queued.length && s.token ? 'pending' : idle, detail: '' })
          // Edits left over from a previous session flush now, not on the next edit.
          tryFlush()
        })
        .catch(() => alive && setSync({ state: navigator.onLine ? 'error' : 'offline', detail: '' }))
    } else {
      setSync({ state: 'readonly', detail: '' })
    }
    return () => {
      alive = false
    }
  }, [])

  const tryFlush = useCallback(async () => {
    const s = loadSettings()
    if (flushing.current || !s.token || !s.repo || !loadQueue().length) return
    if (!navigator.onLine) {
      setSync({ state: 'offline', detail: '' })
      return
    }
    flushing.current = true
    let leftover = false
    try {
      const result = await flushQueue(s)
      // Edits committed while the PUT was in flight are still queued — keep
      // them visible in state and flush again below.
      const rest = loadQueue()
      if (result.data) {
        let merged = result.data
        for (const op of rest) merged = applyOp(merged, op)
        setData(merged)
      }
      setPending(rest.length)
      setSync(rest.length ? { state: 'pending', detail: '' } : { state: 'ok', detail: '' })
      if (result.conflicts?.length)
        showToast(`Heads up: your edit replaced a newer change to ${result.conflicts.join(', ')}`)
      leftover = rest.length > 0
    } catch (e) {
      setPending(loadQueue().length)
      setSync({ state: navigator.onLine ? 'error' : 'offline', detail: e.message })
    } finally {
      flushing.current = false
    }
    if (leftover) tryFlush()
  }, [showToast])

  // Any edit: optimistic apply + queue + attempt flush.
  const commit = useCallback(
    (op) => {
      // Soft edit gate: recipe/ingredient changes need the shared PIN once per device.
      if (GATED_OPS.has(op.type) && !isUnlocked()) {
        setPinOp(op)
        return
      }
      op.at = new Date().toISOString()
      if (op.type === 'putRecipe') {
        // Version this edit was based on — lets the flusher detect that the
        // other phone changed the same recipe in between (spec: LWW + toast).
        const base = dataRef.current?.recipes.find((r) => r.id === op.recipe.id)
        op.baseUpdatedAt = base?.updatedAt || null
      }
      setData((d) => applyOp(d, op))
      const q = loadQueue()
      q.push(op)
      saveQueue(q)
      setPending(q.length)
      const s = loadSettings()
      if (!s.token) {
        setSync({ state: 'readonly', detail: '' })
        showToast('Saved on this phone only — add a GitHub token in Settings to sync')
      } else {
        setSync({ state: 'pending', detail: '' })
        tryFlush()
      }
    },
    [tryFlush, showToast],
  )

  useEffect(() => {
    const onOnline = () => tryFlush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [tryFlush])

  const updateSettings = useCallback(
    (s) => {
      saveSettings(s)
      setSettings(s)
      if (s.repo) {
        fetchLatest(s)
          .then(({ data: d }) => {
            let merged = d
            for (const op of loadQueue()) merged = applyOp(merged, op)
            setData(merged)
            setSync({ state: s.token ? 'ok' : 'readonly', detail: '' })
            tryFlush()
          })
          .catch(() => {})
      }
    },
    [tryFlush],
  )

  const recipe = useMemo(
    () => (nav.id && data ? data.recipes.find((r) => r.id === nav.id) : null),
    [nav, data],
  )

  if (!data) {
    return (
      <div className="app">
        <div className="loading">
          <span className="loading-mark">V's Kitchen</span>
          <span>Warming up…</span>
        </div>
      </div>
    )
  }

  const onDock = DOCK_VIEWS.includes(nav.view)
  const chrome = onDock || nav.view === 'settings'

  // Discrete commit on release: 70px of horizontal travel steps one tab.
  // Gestures that start inside a horizontal scroller belong to that scroller.
  function onPointerDown(e) {
    swipeX.current =
      onDock && !e.target.closest?.('.cat-tabs, .day-strip, .tag-row') ? e.clientX : null
  }
  function onPointerUp(e) {
    const start = swipeX.current
    swipeX.current = null
    if (start == null) return
    const dx = e.clientX - start
    if (Math.abs(dx) <= 70) return
    const i = DOCK_VIEWS.indexOf(nav.view)
    const next = DOCK_VIEWS[Math.min(DOCK_VIEWS.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))]
    if (next !== nav.view) setNav({ view: next })
  }

  return (
    <div className="app">
      {chrome && (
        <Header
          nav={nav}
          setNav={setNav}
          data={data}
          weekStart={weekStart}
          sort={sort}
          sync={sync}
          pending={pending}
        />
      )}
      <main
        className={`main ${chrome ? 'with-dock' : 'bare'}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {nav.view === 'recipes' && (
          <Browse
            data={data}
            sort={sort}
            setSort={setSort}
            openRecipe={(id) => setNav({ view: 'recipe', id, from: 'recipes' })}
            setNav={setNav}
          />
        )}
        {nav.view === 'plan' && (
          <Schedule
            data={data}
            commit={commit}
            showToast={showToast}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            openRecipe={(id) => setNav({ view: 'recipe', id, from: 'plan' })}
          />
        )}
        {nav.view === 'shop' && (
          <Grocery data={data} commit={commit} weekStart={weekStart} setWeekStart={setWeekStart} />
        )}
        {nav.view === 'pantry' && <Library data={data} commit={commit} showToast={showToast} />}
        {nav.view === 'settings' && <Settings settings={settings} onSave={updateSettings} />}
        {nav.view === 'recipe' && recipe && (
          <Recipe
            recipe={recipe}
            data={data}
            commit={commit}
            showToast={showToast}
            onEdit={() => setNav({ view: 'edit', id: recipe.id, from: nav.from })}
            onBack={() => setNav({ view: nav.from || 'recipes' })}
          />
        )}
        {nav.view === 'edit' && recipe && (
          <RecipeEdit
            key={recipe.id}
            recipe={recipe}
            data={data}
            commit={commit}
            showToast={showToast}
            onDone={(id) => setNav({ view: 'recipe', id, from: nav.from })}
            onDeleted={() => setNav({ view: nav.from || 'recipes' })}
          />
        )}
        {nav.view === 'new' && (
          <RecipeEdit
            key="new"
            recipe={null}
            data={data}
            commit={commit}
            showToast={showToast}
            onDone={(id) => setNav({ view: 'recipe', id })}
            onDeleted={() => setNav({ view: 'recipes' })}
          />
        )}
        {(nav.view === 'recipe' || nav.view === 'edit') && !recipe && (
          <div className="empty">Recipe not found.</div>
        )}
      </main>
      {chrome && <Dock view={nav.view} setNav={setNav} />}
      {toast && <div className="toast">{toast}</div>}
      {pinOp && (
        <PinGate
          onCancel={() => {
            setPinOp(null)
            showToast('Edit cancelled')
          }}
          onUnlock={() => {
            unlock()
            const op = pinOp
            setPinOp(null)
            commit(op)
          }}
        />
      )}
    </div>
  )
}

function PinGate({ onCancel, onUnlock }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)
  function submit() {
    if (val === EDIT_PIN) onUnlock()
    else {
      setErr(true)
      setVal('')
    }
  }
  return (
    <div className="pin-backdrop" onClick={onCancel}>
      <div className="pin-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="pin-title">Enter edit PIN</h2>
        <p className="pin-hint">
          Asked once on this device. Stays unlocked until you tap “Lock editing” in Settings.
        </p>
        <input
          className={`pin-input ${err ? 'err' : ''}`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={val}
          onChange={(e) => {
            setVal(e.target.value)
            setErr(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {err && <div className="pin-err">Wrong PIN — try again.</div>}
        <div className="pin-actions">
          <button className="pin-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="pin-btn primary" onClick={submit}>
            Unlock
          </button>
        </div>
      </div>
    </div>
  )
}

const SYNC_LABEL = {
  loading: 'Loading…',
  ok: 'Synced',
  readonly: 'Read-only — no token',
  pending: 'Syncing…',
  offline: 'Offline',
  error: 'Sync error',
}

// What "N pending" means depends on the state. Only 'pending'/'loading' are
// actually in flight — the rest mean the queue is STUCK, and the eyebrow has
// to say so rather than reading like a normal sync.
const PENDING_WORD = {
  loading: 'pending',
  ok: 'pending',
  pending: 'pending',
  offline: 'offline — not synced',
  readonly: 'not synced (no token)',
  error: 'not syncing',
}

const SORT_LABEL = {
  density: 'by density',
  protein: 'by protein',
  kcal: 'by calories',
  name: 'A–Z',
}

function Dock({ view, setNav }) {
  return (
    <nav className="dock">
      {DOCK_VIEWS.map((v) => (
        <button
          key={v}
          className={`dock-tab ${view === v ? 'active' : ''}`}
          aria-current={view === v ? 'page' : undefined}
          onClick={() => setNav({ view: v })}
        >
          <Icon name={v} size={17} />
          {DOCK_LABELS[v]}
        </button>
      ))}
    </nav>
  )
}

// Eyebrow + title come from the active route; the gear is the only other
// control up here. Sync state lives in the Settings eyebrow, so a queue that
// is stuck gets a dot on the gear — otherwise it would be invisible until
// someone happened to open Settings.
function Header({ nav, setNav, data, weekStart, sort, sync, pending }) {
  const syncText = pending
    ? `${pending} ${PENDING_WORD[sync.state] || 'pending'}`
    : SYNC_LABEL[sync.state] || SYNC_LABEL.loading
  const stuck = pending > 0 && sync.state !== 'pending' && sync.state !== 'loading'
  const week = weekRangeLabel(weekStart)
  const HEAD = {
    recipes: [`${data.recipes.length} recipes · ${SORT_LABEL[sort] || SORT_LABEL.density}`, 'Recipes'],
    plan: [week, 'This week'],
    shop: [week, 'Groceries'],
    pantry: [`${Object.keys(data.ingredients).length} ingredients`, 'Ingredient library'],
    settings: [syncText, 'Settings'],
  }
  const [eyebrow, title] = HEAD[nav.view] || HEAD.recipes
  const onSettings = nav.view === 'settings'
  return (
    <header className="header">
      <div className="head-text">
        <span className="head-eyebrow">{eyebrow}</span>
        <h1 className="head-title">{title}</h1>
      </div>
      <div className="head-actions">
        {nav.view === 'recipes' && (
          <button
            className="round-btn dark press"
            onClick={() => setNav({ view: 'new' })}
            aria-label="Add recipe"
          >
            <Icon name="plus" size={18} />
          </button>
        )}
        <button
          className="round-btn press"
          onClick={() => setNav({ view: onSettings ? 'recipes' : 'settings' })}
          aria-label={onSettings ? 'Close settings' : `Settings — ${syncText}`}
          title={sync.detail || syncText}
        >
          <Icon name="gear" size={17} />
          {stuck && <span className="stuck-dot" />}
        </button>
      </div>
    </header>
  )
}
