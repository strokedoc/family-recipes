import React, { useMemo, useState } from 'react'
import { buildGroceryList, weekStartOf, addDays, weekRangeLabel } from '../lib/planner.js'

function makeId() {
  return `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export default function Grocery({ data, commit }) {
  const [weekStart, setWeekStart] = useState(() => weekStartOf())
  const [text, setText] = useState('')
  const thisWeek = weekStartOf()

  const { items, extra } = useMemo(() => buildGroceryList(data, weekStart), [data, weekStart])

  function save(nextItems, nextExtra) {
    commit({
      type: 'setGroceryList',
      week: weekStart,
      state: {
        checkedRefs: nextItems.filter((i) => i.checked).map((i) => i.ref),
        extra: nextExtra,
      },
    })
  }

  function toggleItem(ref) {
    save(items.map((i) => (i.ref === ref ? { ...i, checked: !i.checked } : i)), extra)
  }

  function toggleExtra(id) {
    save(items, extra.map((e) => (e.id === id ? { ...e, checked: !e.checked } : e)))
  }

  function addExtra() {
    const t = text.trim()
    if (!t) return
    save(items, [...extra, { id: makeId(), text: t, checked: false }])
    setText('')
  }

  function removeExtra(id) {
    save(items, extra.filter((e) => e.id !== id))
  }

  const isEmpty = items.length === 0 && extra.length === 0

  return (
    <div className="grocery">
      <div className="week-nav">
        <button
          className="icon-btn"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="week-label-wrap">
          <span className="week-label">{weekRangeLabel(weekStart)}</span>
          {weekStart !== thisWeek && (
            <button className="link-btn today-btn" onClick={() => setWeekStart(thisWeek)}>
              This week
            </button>
          )}
        </div>
        <button
          className="icon-btn"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <p className="library-hint">
        Pulled from this week's schedule — fresh veg, fruit, dairy &amp; tofu only, no pantry
        staples. Check off what you've already got.
      </p>

      {isEmpty ? (
        <div className="empty">Nothing here yet — plan some meals in Schedule first.</div>
      ) : (
        <ul className="grocery-list">
          {items.map((item) => (
            <li key={item.ref} className={`grocery-item ${item.checked ? 'checked' : ''}`}>
              <label className="grocery-check">
                <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item.ref)} />
                <span className="grocery-name">{item.name}</span>
              </label>
              <span className="grocery-grams">{Math.round(item.grams)} g</span>
            </li>
          ))}
          {extra.map((e) => (
            <li key={e.id} className={`grocery-item ${e.checked ? 'checked' : ''}`}>
              <label className="grocery-check">
                <input type="checkbox" checked={e.checked} onChange={() => toggleExtra(e.id)} />
                <span className="grocery-name">{e.text}</span>
              </label>
              <button className="remove-btn" aria-label="Remove item" onClick={() => removeExtra(e.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="add-extra-row">
        <input
          className="add-extra-input"
          placeholder="Add something else…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addExtra()}
        />
        <button className="secondary-btn" onClick={addExtra}>
          Add
        </button>
      </div>
    </div>
  )
}
