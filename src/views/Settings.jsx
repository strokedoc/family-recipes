import React, { useState } from 'react'
import { testConnection } from '../lib/github.js'

export default function Settings({ settings, onSave, onBack }) {
  const [repo, setRepo] = useState(settings.repo || '')
  const [token, setToken] = useState(settings.token || '')
  const [status, setStatus] = useState(null) // {ok, msg}
  const [testing, setTesting] = useState(false)

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
      <div className="detail-nav">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
      </div>
      <h1 className="detail-title">Settings</h1>
      <p className="library-hint">
        Recipes live in a GitHub repo you both share. Each phone gets its own token so commits say
        who made them. Full walkthrough in the repo's SETUP.md.
      </p>
      <label className="field">
        <span>Repository (owner/name)</span>
        <input
          placeholder="e.g. nirav/family-recipes"
          autoCapitalize="none"
          autoCorrect="off"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />
      </label>
      <label className="field">
        <span>GitHub token (fine-grained, Contents read/write)</span>
        <input
          type="password"
          placeholder="github_pat_…"
          autoCapitalize="none"
          autoCorrect="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <button className="primary-btn" onClick={saveAndTest} disabled={testing}>
        {testing ? 'Testing…' : 'Save & test'}
      </button>
      {status && <div className={`status ${status.ok ? 'ok' : 'err'}`}>{status.msg}</div>}
      <p className="library-hint">
        No token? Everything still works for reading — that's the intended fallback, not an error.
        The token stays in this phone's storage only; it is never sent anywhere except GitHub.
      </p>
    </div>
  )
}
