import React, { useMemo, useState } from 'react'
import { fmt, recipesUsing } from '../lib/nutrition.js'

const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fiber']

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function Library({ data, commit, showToast, onBack }) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null) // key being edited, or '__new__'

  const entries = useMemo(() => {
    const list = Object.entries(data.ingredients).map(([key, ing]) => ({ key, ing }))
    const needle = q.trim().toLowerCase()
    return (needle
      ? list.filter(({ key, ing }) => ing.name.toLowerCase().includes(needle) || key.includes(needle))
      : list
    ).sort((a, b) => a.ing.name.localeCompare(b.ing.name))
  }, [data, q])

  function saveIngredient(key, ing) {
    commit({ type: 'putIngredient', key, ingredient: ing })
    setEditing(null)
  }

  function addIngredient(ing) {
    const key = slugify(ing.name)
    if (!key) return showToast('Name needs some letters')
    if (data.ingredients[key]) return showToast(`"${key}" already exists`)
    commit({ type: 'putIngredient', key, ingredient: ing })
    setEditing(null)
  }

  function deleteIngredient(key) {
    const used = recipesUsing(data, key)
    if (used.length) {
      showToast(`Can't delete — used by: ${used.map((r) => r.name).join(', ')}`)
      return
    }
    if (!window.confirm(`Delete "${data.ingredients[key].name}" from the library?`)) return
    commit({ type: 'deleteIngredient', key })
    setEditing(null)
  }

  return (
    <div className="library">
      <div className="detail-nav">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <button className="primary-btn" onClick={() => setEditing('__new__')}>
          + Ingredient
        </button>
      </div>
      <h1 className="detail-title">Ingredient library</h1>
      <p className="library-hint">
        Per-100g values drive every recipe number. Calibrated something against Cronometer? Fix it
        here and all recipes update.
      </p>
      <input
        className="search"
        type="search"
        placeholder="Search ingredients…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="lib-list">
        {entries.map(({ key, ing }) => (
          <li key={key} className="lib-row-wrap">
            {editing === key ? (
              <IngredientForm
                initial={ing}
                onSave={(next) => saveIngredient(key, next)}
                onCancel={() => setEditing(null)}
                onDelete={() => deleteIngredient(key)}
              />
            ) : (
              <button className="lib-row" onClick={() => setEditing(key)}>
                <span className="picker-name">{ing.name}</span>
                <span className="picker-macros">
                  {fmt(ing.per100g.kcal)} kcal · P{fmt(ing.per100g.protein, 1)} · C
                  {fmt(ing.per100g.carbs, 1)} · F{fmt(ing.per100g.fat, 1)} /100g
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing === '__new__' && (
        <div className="sheet-backdrop" onClick={() => setEditing(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="section-title">New ingredient</h2>
            <IngredientForm
              initial={{ name: '', per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }, tags: [] }}
              onSave={addIngredient}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function IngredientForm({ initial, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(initial.name)
  const [vals, setVals] = useState({ ...initial.per100g })
  const [note, setNote] = useState(initial.note || '')

  function save() {
    if (!name.trim()) return
    const per100g = {}
    for (const m of MACROS) per100g[m] = Number(vals[m]) || 0
    const ing = { ...initial, name: name.trim(), per100g }
    if (note.trim()) ing.note = note.trim()
    else delete ing.note
    onSave(ing)
  }

  return (
    <div className="ing-form">
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="macro-inputs">
        {MACROS.map((m) => (
          <label key={m} className="field small">
            <span>{m}/100g</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={vals[m]}
              onChange={(e) => setVals((v) => ({ ...v, [m]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <label className="field">
        <span>Note (e.g. "1 scoop = 31 g")</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="form-actions">
        <button className="primary-btn" onClick={save}>
          Save
        </button>
        <button className="secondary-btn" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button className="danger-btn slim" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
