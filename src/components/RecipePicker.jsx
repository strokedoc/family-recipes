import React, { useMemo, useState } from 'react'
import { perServing, fmt } from '../lib/nutrition.js'

export default function RecipePicker({ data, onPick, onClose }) {
  const [q, setQ] = useState('')
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
        <ul className="picker-list">
          {entries.map(({ recipe, macros }) => (
            <li key={recipe.id}>
              <button className="picker-row" onClick={() => onPick(recipe.id)}>
                <span className="picker-name">{recipe.name}</span>
                <span className="picker-macros">
                  {fmt(macros.kcal)} kcal · P{fmt(macros.protein)} per serving
                </span>
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="empty">No recipes match.</li>}
        </ul>
      </div>
    </div>
  )
}
