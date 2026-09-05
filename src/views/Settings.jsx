import React, { useState } from 'react'
import { testConnection } from '../lib/github.js'
import { isUnlocked, lock } from '../lib/editlock.js'

export default function Settings({ settings, onSave }) {
  const [repo, setRepo] = useState(settings.repo || '')
  const [token, setToken] = useState(settings.token || '')
  const [status, setStatus] = useState(null) // {ok, msg}
  const [testing, setTesting] = useState(false)
  const [unlocked, setUnlocked] = useState(isUnlocked())

  async function saveAndTest() {
    const next = { repo: repo.trim(), token: token.trim() }
    onSave(next)
    if (!next.repo) {
      setStatus({ ok: true, msg: 'Saved. No repo set — app is read-only.' })
      return
    }
    setTesting(true)
    setStatus(null)
    try {
      const { canWrite } = await testConnection(next)
      setStatus(
        canWrite
          ? { ok: true, msg: '✓ Sync OK — you can read and save recipes.' }
          : { ok: true, msg: '✓ Connected read-only. Add a token with Contents write access to save edits.' },
      )
    } catch (e) {
      setStatus({ ok: false, msg: `✕ ${e.message}` })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="settings">
      <div className="field-group">
        <label className="field-row-line">
          <span>Repository</span>
          <input
            placeholder="owner/name"
            autoCapitalize="none"
            autoCorrect="off"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          />
        </label>
        <label className="field-row-line">
          <span>GitHub token</span>
          <input
            type="password"
            placeholder="github_pat_…"
            autoCapitalize="none"
            autoCorrect="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <div className="field-row-line">
          <span>Editing on this device</span>
          <span className="row-value">{unlocked ? 'Unlocked' : 'Locked'}</span>
        </div>
      </div>

      <button className="wide-btn press" onClick={saveAndTest} disabled={testing}>
        {testing ? 'Testing…' : 'Save & test'}
      </button>
      {status && <div className={`status ${status.ok ? 'ok' : 'err'}`}>{status.msg}</div>}
      <p className="library-hint">
        Recipes live in a GitHub repo you both share; each phone gets its own token. No token is the
        intended read-only fallback, not an error — the token stays in this phone's storage and is
        never sent anywhere except GitHub.
      </p>

      <section className="settings-card">
        <span className="card-label">Editing lock</span>
        <p className="library-hint lock-copy">
          Adding, changing or deleting a recipe or ingredient asks for a PIN the first time on each
          device, then stays unlocked. Schedule and grocery edits aren't locked.
        </p>
        <button
          className="ghost-btn press"
          disabled={!unlocked}
          onClick={() => {
            lock()
            setUnlocked(false)
          }}
        >
          {unlocked ? 'Lock editing' : 'Already locked'}
        </button>
      </section>
    </div>
  )
}
