import React, { useMemo, useState } from 'react'
import { buildGroceryList, addDays, weekStartOf } from '../lib/planner.js'
import Icon from '../components/Icon.jsx'

function makeId() {
  return `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export default function Grocery({ data, commit, weekStart, setWeekStart }) {
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

  const all = [...items, ...extra]
  const picked = all.filter((i) => i.checked).length
  const isEmpty = all.length === 0

  return (
    <div className="grocery">
      {/* The header names the week; these only step it. */}
      <div className="week-nav">
        <button className="icon-btn press" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
          ‹
        </button>
        <button className="icon-btn press" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
          ›
        </button>
        {weekStart !== thisWeek && (
          <button className="quiet-btn" onClick={() => setWeekStart(thisWeek)}>
            Back to this week
          </button>
        )}
      </div>

      <section className="shop-progress">
        <div>
          <span className="shop-count">{picked}</span>
          <span className="shop-count-rest">of {all.length} picked up</span>
        </div>
        <span className="shop-track">
          <span style={{ width: all.length ? `${(picked / all.length) * 100}%` : '0%' }} />
        </span>
        <p className="shop-note">Fresh only — pantry staples stay off the list.</p>
      </section>

      {isEmpty ? (
        <div className="empty">Nothing here yet — plan some meals first.</div>
      ) : (
        <ul className="grocery-list">
          {items.map((item) => (
            <li key={item.ref}>
              <button
                className={`grocery-item press ${item.checked ? 'checked' : ''}`}
                aria-pressed={item.checked}
                onClick={() => toggleItem(item.ref)}
              >
                <span className="grocery-box">
                  <Icon name="check" size={15} />
                </span>
                <span className="grocery-name">{item.name}</span>
                <span className="grocery-grams">{Math.round(item.grams)} g</span>
              </button>
            </li>
          ))}
          {extra.map((e) => (
            <li key={e.id} className="grocery-extra">
              <button
                className={`grocery-item press ${e.checked ? 'checked' : ''}`}
                aria-pressed={e.checked}
                onClick={() => toggleExtra(e.id)}
              >
                <span className="grocery-box">
                  <Icon name="check" size={15} />
                </span>
                <span className="grocery-name">{e.text}</span>
              </button>
              <button
                className="grocery-remove"
                aria-label={`Remove ${e.text}`}
                onClick={() => removeExtra(e.id)}
              >
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
        <button className="add-extra-btn press" onClick={addExtra} aria-label="Add item">
          <Icon name="plus" size={20} />
        </button>
      </div>
    </div>
  )
}
