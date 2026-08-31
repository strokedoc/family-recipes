import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Browse from './views/Browse.jsx'
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
  fetchProfiles,
  flushQueue,
} from './lib/store.js'
import { fetchLatest } from './lib/github.js'

export default function App() {
  const [nav, setNav] = useState({ view: 'browse' })
  const [data, setData] = useState(null)
  const [profiles, setProfiles] = useState(null)
  const [settings, setSettings] = useState(loadSettings)
  const [pending, setPending] = useState(loadQueue().length)
  const [sync, setSync] = useState({ state: 'loading', detail: '' }) // loading | readonly | ok | pending | offline | error
  const [toast, setToast] = useState(null)
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
    fetchProfiles().then((p) => alive && setProfiles(p))
    fetchLocalData()
      .then((d) => alive && setData((cur) => cur || d))
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

  return (
    <div className="app">
      <Header
        nav={nav}
        setNav={setNav}
        sync={sync}
        pending={pending}
        onRetry={tryFlush}
      />
      <main className="main">
        {nav.view === 'browse' && (
          <Browse data={data} openRecipe={(id) => setNav({ view: 'recipe', id })} setNav={setNav} />
        )}
        {nav.view === 'recipe' && recipe && (
          <Recipe
            recipe={recipe}
            data={data}
            profiles={profiles}
            commit={commit}
            showToast={showToast}
            onEdit={() => setNav({ view: 'edit', id: recipe.id })}
            onBack={() => setNav({ view: 'browse' })}
          />
        )}
        {nav.view === 'edit' && recipe && (
          <RecipeEdit
            key={recipe.id}
            recipe={recipe}
            data={data}
            commit={commit}
            showToast={showToast}
            onDone={(id) => setNav({ view: 'recipe', id })}
            onDeleted={() => setNav({ view: 'browse' })}
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

function Header({ nav, setNav, sync, pending, onRetry }) {
  const [dotClass, label] = SYNC_LABEL[sync.state] || SYNC_LABEL.loading
  // Unsynced edits are never hidden behind a green "Synced" label.
  const showPending = pending > 0
  return (
    <header className="header">
      <button className="brand" onClick={() => setNav({ view: 'browse' })}>
        <span className="brand-mark">V's</span>
        <span className="brand-name">Kitchen</span>
      </button>
      <div className="header-right">
        <button
          className="sync-chip"
          onClick={onRetry}
          title={sync.detail || label}
          aria-label={`Sync status: ${label}`}
        >
          <span className={dotClass} />
          {showPending ? `${pending} pending` : label}
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
