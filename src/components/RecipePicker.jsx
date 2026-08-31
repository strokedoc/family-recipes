import React, { useMemo, useState } from 'react'
import { perServing, fmt } from '../lib/nutrition.js'

export default function RecipePicker({ data, onPick, onPickMany, onClose, multi = false, title }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set())

  const entries = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = data.recipes.map((recipe) => ({
      recipe,
      macros: perServing(recipe, data.ingredients),
    }))
    const shown = needle
      ? list.filter(
          ({ recipe }) =>
            recipe.name.toLowerCase().includes(needle) ||
            recipe.category.includes(needle) ||
            recipe.tags?.some((t) => t.includes(needle)),
        )
      : list
    return shown.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name))
  }, [data, q])

  function toggle(id) {
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <input
            autoFocus
            className="search"
            type="search"
            placeholder="Search recipes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {multi && title && <p className="sheet-note">{title}</p>}
        <ul className="picker-list">
          {entries.map(({ recipe, macros }) => (
            <li key={recipe.id}>
              <button
                className={`picker-row ${multi && sel.has(recipe.id) ? 'sel' : ''}`}
                onClick={() => (multi ? toggle(recipe.id) : onPick(recipe.id))}
              >
                {multi && (
                  <span className="picker-check">{sel.has(recipe.id) ? '☑' : '☐'}</span>
                )}
                <span className="picker-name">{recipe.name}</span>
                <span className="picker-macros">
                  {fmt(macros.kcal)} kcal · P{fmt(macros.protein)}
                </span>
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="empty">No recipes match.</li>}
        </ul>
        {multi && (
          <div className="sheet-foot">
            <button className="pin-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="pin-btn primary"
              disabled={sel.size === 0}
              onClick={() => onPickMany([...sel])}
            >
              Add {sel.size || ''} {sel.size === 1 ? 'recipe' : 'recipes'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
