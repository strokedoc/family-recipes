import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Browse from './views/Browse.jsx'
import Schedule from './views/Schedule.jsx'
import Grocery from './views/Grocery.jsx'
import Recipe from './views/Recipe.jsx'
import RecipeEdit from './views/RecipeEdit.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'
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

export default function App() {
  const [nav, setNav] = useState({ view: 'browse' })
  const [data, setData] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [pending, setPending] = useState(loadQueue().length)
  const [sync, setSync] = useState({ state: 'loading', detail: '' }) // loading | readonly | ok | pending | offline | error
  const [toast, setToast] = useState(null)
  const [pinOp, setPinOp] = useState(null) // op held back until the edit PIN is entered
  const flushing = useRef(false)
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

  const TOP_VIEWS = ['browse', 'schedule', 'grocery']

  return (
    <div className="app">
      <Header
        nav={nav}
        setNav={setNav}
        sync={sync}
        pending={pending}
        onRetry={tryFlush}
      />
      {TOP_VIEWS.includes(nav.view) && (
        <nav className="main-tabs">
          {TOP_VIEWS.map((v) => (
            <button
              key={v}
              className={`main-tab ${nav.view === v ? 'active' : ''}`}
              onClick={() => setNav({ view: v })}
            >
              {{ browse: 'Recipes', schedule: 'Schedule', grocery: 'Grocery' }[v]}
            </button>
          ))}
        </nav>
      )}
      <main className="main">
        {nav.view === 'browse' && (
          <Browse
            data={data}
            openRecipe={(id) => setNav({ view: 'recipe', id, from: 'browse' })}
            setNav={setNav}
          />
        )}
        {nav.view === 'schedule' && (
          <Schedule
            data={data}
            commit={commit}
            showToast={showToast}
            openRecipe={(id) => setNav({ view: 'recipe', id, from: 'schedule' })}
          />
        )}
        {nav.view === 'grocery' && <Grocery data={data} commit={commit} />}
        {nav.view === 'recipe' && recipe && (
          <Recipe
            recipe={recipe}
            data={data}
            commit={commit}
            showToast={showToast}
            onEdit={() => setNav({ view: 'edit', id: recipe.id, from: nav.from })}
            onBack={() => setNav({ view: nav.from || 'browse' })}
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
            onDeleted={() => setNav({ view: nav.from || 'browse' })}
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
            onDeleted={() => setNav({ view: 'browse' })}
          />
        )}
        {nav.view === 'library' && (
          <Library data={data} commit={commit} showToast={showToast} onBack={() => setNav({ view: 'browse' })} />
        )}
        {nav.view === 'settings' && (
          <Settings settings={settings} onSave={updateSettings} onBack={() => setNav({ view: 'browse' })} />
        )}
        {(nav.view === 'recipe' || nav.view === 'edit') && !recipe && (
          <div className="empty">Recipe not found.</div>
        )}
      </main>
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
  loading: ['sync-dot loading', 'Loading'],
  ok: ['sync-dot ok', 'Synced'],
  readonly: ['sync-dot readonly', 'Read-only'],
  pending: ['sync-dot pending', 'Syncing'],
  offline: ['sync-dot pending', 'Offline'],
  error: ['sync-dot error', 'Sync error'],
}

// What "N pending" means depends on the state. Only 'pending'/'loading' are
// actually in flight — the rest mean the queue is STUCK, and the chip has to
// say so rather than reading like a normal sync.
const PENDING_WORD = {
  loading: 'pending',
  ok: 'pending',
  pending: 'pending',
  offline: 'offline — not synced',
  readonly: 'not synced (no token)',
  error: 'not syncing',
}

function Header({ nav, setNav, sync, pending, onRetry }) {
  const [dotClass, label] = SYNC_LABEL[sync.state] || SYNC_LABEL.loading
  // Unsynced edits are never hidden behind a green "Synced" label — and when
  // the queue is stuck, the chip must name the problem, not just count it.
  const showPending = pending > 0
  const stuck = showPending && sync.state !== 'pending' && sync.state !== 'loading'
  const chipText = showPending ? `${pending} ${PENDING_WORD[sync.state] || 'pending'}` : label
  return (
    <header className="header">
      <button className="brand" onClick={() => setNav({ view: 'browse' })}>
        <span className="brand-mark">V's</span>
        <span className="brand-name">Kitchen</span>
      </button>
      <div className="header-right">
        <button
          className={`sync-chip ${stuck ? 'stuck' : ''}`}
          onClick={onRetry}
          title={sync.detail || (showPending ? `${pending} unsynced edit${pending === 1 ? '' : 's'} — tap to retry` : label)}
          aria-label={showPending ? `${chipText}, tap to retry` : `Sync status: ${label}`}
        >
          <span className={dotClass} />
          {chipText}
        </button>
        <button
          className={`icon-btn ${nav.view === 'library' ? 'active' : ''}`}
          onClick={() => setNav({ view: 'library' })}
          aria-label="Ingredient library"
        >
          ⚖︎
        </button>
        <button
          className={`icon-btn ${nav.view === 'settings' ? 'active' : ''}`}
          onClick={() => setNav({ view: 'settings' })}
          aria-label="Settings"
        >
          ⚙︎
        </button>
      </div>
    </header>
  )
}
