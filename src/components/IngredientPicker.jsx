import React, { useMemo, useState } from 'react'
import { fmt } from '../lib/nutrition.js'

export default function IngredientPicker({ ingredients, onPick, onClose }) {
  const [q, setQ] = useState('')
  const entries = useMemo(() => {
    const list = Object.entries(ingredients).map(([key, ing]) => ({ key, ing }))
    const needle = q.trim().toLowerCase()
    const shown = needle
      ? list.filter(
          ({ key, ing }) =>
            ing.name.toLowerCase().includes(needle) ||
            key.includes(needle) ||
            ing.tags?.some((t) => t.includes(needle)),
        )
      : list
    return shown.sort((a, b) => a.ing.name.localeCompare(b.ing.name))
  }, [ingredients, q])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <input
            autoFocus
            className="search"
            type="search"
            placeholder="Search library…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className="picker-list">
          {entries.map(({ key, ing }) => (
            <li key={key}>
              <button className="picker-row" onClick={() => onPick(key)}>
                <span className="picker-name">{ing.name}</span>
                <span className="picker-macros">
                  {fmt(ing.per100g.kcal)} kcal · P{fmt(ing.per100g.protein)} /100g
                </span>
              </button>
            </li>
          ))}
          {entries.length === 0 && (
            <li className="empty">Not in the library — add it from the ⚖︎ Library screen.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
