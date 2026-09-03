import React, { useState } from 'react'
import RecipePicker from '../components/RecipePicker.jsx'
import {
  MEALS,
  MEAL_LABELS,
  slotIds,
  weekStartOf,
  weekDates,
  addDays,
  dayLabel,
  weekRangeLabel,
  isToday,
  autoFillWeek,
} from '../lib/planner.js'
import { buildDay, dayTotals, dayBars, swapOptions, DAILY_TARGET } from '../lib/scheduler.js'
import { applyOp } from '../lib/store.js'

export default function Schedule({ data, commit, openRecipe, showToast }) {
  const [weekStart, setWeekStart] = useState(() => weekStartOf())
  // sheet: null | {mode:'single'|'add', date, meal} | {mode:'multi'}
  //             | {mode:'move', date, meal} | {mode:'swap', date, meal, recipeId}
  const [sheet, setSheet] = useState(null)

  const dates = weekDates(weekStart)
  const thisWeek = weekStartOf()

  const dayIsEmpty = (date) =>
    MEALS.every((m) => slotIds(data.schedule?.[date]?.[m]).length === 0)

  function setSlot(date, meal, ids) {
    commit({ type: 'setMeal', date, meal, recipeId: ids })
    setSheet(null)
  }

  function addToSlot(date, meal, id) {
    setSlot(date, meal, [...slotIds(data.schedule?.[date]?.[meal]), id])
  }

  function removeFromSlot(date, meal, id) {
    setSlot(
      date,
      meal,
      slotIds(data.schedule?.[date]?.[meal]).filter((x) => x !== id),
    )
  }

  function swapIn(newId) {
    const { date, meal, recipeId } = sheet
    setSlot(
      date,
      meal,
      slotIds(data.schedule?.[date]?.[meal]).map((x) => (x === recipeId ? newId : x)),
    )
  }

  // One click: build a balanced day and drop it in as a single edit.
  function fillDay(date) {
    if (!dayIsEmpty(date) && !window.confirm(`Replace everything scheduled for ${dayLabel(date).date}?`))
      return
    const { slots, warnings } = buildDay(data, date)
    if (!slots.lunch.length) return showToast?.(warnings[0] || 'Could not build that day.')
    commit({ type: 'setDay', date, slots })
    if (warnings.length) showToast?.(warnings[0])
  }

  // Fill every empty day in the week. Each day is built against the days already
  // placed, so the 7-day variety rule still applies within the run.
  function fillWeek() {
    let working = data
    let placed = 0
    const warned = []
    for (const date of dates) {
      if (!MEALS.every((m) => slotIds(working.schedule?.[date]?.[m]).length === 0)) continue
      const { slots, warnings } = buildDay(working, date)
      if (!slots.lunch.length) continue
      const op = { type: 'setDay', date, slots }
      commit(op)
      working = applyOp(working, op)
      placed++
      if (warnings.length) warned.push(dayLabel(date).weekday)
    }
    if (!placed) return showToast?.('Every day this week already has something scheduled.')
    showToast?.(
      warned.length
        ? `Filled ${placed} day${placed === 1 ? '' : 's'} — ${warned.join(', ')} came up short on protein.`
        : `Filled ${placed} day${placed === 1 ? '' : 's'}.`,
    )
  }

  function autoFill(ids) {
    const { ops, placed, skipped } = autoFillWeek(data, weekStart, ids)
    ops.forEach((op) => commit({ type: 'setMeal', ...op }))
    setSheet(null)
    showToast?.(
      skipped
        ? `Added ${placed} — ${skipped} didn't fit (week's full).`
        : `Added ${placed} recipe${placed === 1 ? '' : 's'} across the week.`,
    )
  }

  function move(toDate, toMeal) {
    const { date: fromDate, meal: fromMeal } = sheet
    if (toDate === fromDate && toMeal === fromMeal) return setSheet(null)
    const moving = slotIds(data.schedule?.[fromDate]?.[fromMeal])
    const occupant = slotIds(data.schedule?.[toDate]?.[toMeal])
    commit({ type: 'setMeal', date: toDate, meal: toMeal, recipeId: moving })
    commit({ type: 'setMeal', date: fromDate, meal: fromMeal, recipeId: occupant })
    setSheet(null)
  }

  function clearWeek() {
    if (!window.confirm(`Clear every meal for ${weekRangeLabel(weekStart)}?`)) return
    for (const date of dates) {
      const day = data.schedule?.[date] || {}
      for (const meal of MEALS) {
        if (slotIds(day[meal]).length) commit({ type: 'setMeal', date, meal, recipeId: null })
      }
    }
  }

  const swapping = sheet?.mode === 'swap' ? data.recipes.find((r) => r.id === sheet.recipeId) : null

  return (
    <div className="schedule">
      <div className="week-nav">
        <button className="icon-btn" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week">
          ‹
        </button>
        <div className="week-label-wrap">
          <span className="week-label">{weekRangeLabel(weekStart)}</span>
          {weekStart !== thisWeek && (
            <button className="link-btn today-btn" onClick={() => setWeekStart(thisWeek)}>
              Today
            </button>
          )}
        </div>
        <button className="icon-btn" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week">
          ›
        </button>
      </div>

      <div className="plan-bar">
        <button className="autofill-btn" onClick={fillWeek}>
          ✨ Fill empty days
        </button>
        <button className="link-btn" onClick={() => setSheet({ mode: 'multi' })}>
          Add specific
        </button>
        <button className="link-btn" onClick={clearWeek}>
          Clear week
        </button>
      </div>

      <div className="day-list">
        {dates.map((date) => {
          const day = data.schedule?.[date] || {}
          const empty = dayIsEmpty(date)
          const totals = dayTotals(data, day)
          return (
            <div key={date} className={`day-card ${isToday(date) ? 'today' : ''}`}>
              <div className="day-head">
                <span className="day-weekday">{dayLabel(date).weekday}</span>
                <span className="day-date">{dayLabel(date).date}</span>
                <button className="day-fill" onClick={() => fillDay(date)}>
                  {empty ? '✨ Fill' : '↻ Rebuild'}
                </button>
              </div>

              <div className="meal-rows">
                {MEALS.map((meal) => {
                  const ids = slotIds(day[meal])
                  return (
                    <div key={meal} className="meal-row">
                      <span className="meal-label">{MEAL_LABELS[meal]}</span>
                      <div className="meal-items">
                        {ids.map((id) => {
                          const r = data.recipes.find((x) => x.id === id)
                          return (
                            <span key={id} className="meal-chip">
                              <button
                                className="meal-chip-name"
                                aria-label={`Swap ${r?.name || id}`}
                                title="Tap to swap for something similar"
                                onClick={() => setSheet({ mode: 'swap', date, meal, recipeId: id })}
                              >
                                {r ? r.name : id}
                              </button>
                              <button
                                className="meal-chip-x"
                                aria-label={`Remove ${r?.name || id}`}
                                onClick={() => removeFromSlot(date, meal, id)}
                              >
                                ✕
                              </button>
                            </span>
                          )
                        })}
                        <button
                          className="meal-add"
                          aria-label={`Add to ${MEAL_LABELS[meal]}`}
                          onClick={() => setSheet({ mode: 'add', date, meal })}
                        >
                          +
                        </button>
                        {ids.length > 0 && (
                          <button
                            className="meal-move"
                            aria-label={`Move ${MEAL_LABELS[meal]}`}
                            onClick={() => setSheet({ mode: 'move', date, meal })}
                          >
                            ⤢
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {!empty && <DayBars totals={totals} />}
            </div>
          )
        })}
      </div>

      {(sheet?.mode === 'add' || sheet?.mode === 'single') && (
        <RecipePicker
          data={data}
          onPick={(id) => addToSlot(sheet.date, sheet.meal, id)}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.mode === 'multi' && (
        <RecipePicker
          data={data}
          multi
          title="Pick several — they'll be scattered into this week's empty slots by meal type."
          onPickMany={autoFill}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.mode === 'swap' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="sheet-title">Swap “{swapping?.name}”</span>
              <button className="icon-btn" onClick={() => setSheet(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="swap-list">
              {swapOptions(data, sheet.recipeId).map((o) => (
                <button key={o.recipe.id} className="swap-row" onClick={() => swapIn(o.recipe.id)}>
                  <span className="swap-name">{o.recipe.name}</span>
                  <span className="swap-deltas">
                    <span className={`swap-d ${o.dProtein >= 0 ? 'good' : 'bad'}`}>
                      {fmtDelta(o.dProtein)} g P
                    </span>
                    <span className={`swap-d ${o.dKcal <= 0 ? 'good' : 'bad'}`}>
                      {fmtDelta(o.dKcal)} kcal
                    </span>
                  </span>
                </button>
              ))}
              {swapOptions(data, sheet.recipeId).length === 0 && (
                <p className="sheet-note">Nothing else shares this recipe's role yet.</p>
              )}
            </div>
            <p className="sheet-note">Closest match first. Tap to replace.</p>
          </div>
        </div>
      )}

      {sheet?.mode === 'move' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="sheet-title">Move {MEAL_LABELS[sheet.meal]}</span>
              <button className="icon-btn" onClick={() => setSheet(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="move-grid">
              {dates.map((date) => (
                <div key={date} className="move-day">
                  <span className="move-day-label">
                    {dayLabel(date).weekday} {dayLabel(date).date}
                  </span>
                  <div className="move-slots">
                    {MEALS.map((meal) => {
                      const occ = slotIds(data.schedule?.[date]?.[meal]).length
                      const here = date === sheet.date && meal === sheet.meal
                      return (
                        <button
                          key={meal}
                          className={`move-slot ${occ ? 'occ' : ''} ${here ? 'here' : ''}`}
                          disabled={here}
                          title={MEAL_LABELS[meal]}
                          onClick={() => move(date, meal)}
                        >
                          {MEAL_LABELS[meal][0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="sheet-note">Tap a slot to move it there. If that slot is taken, the two swap.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtDelta(n) {
  const v = Math.round(n)
  return v > 0 ? `+${v}` : `${v}`
}

// Protein fills toward a number you want to reach; the other three are ceilings.
// Net carbs, not total — fiber runs high here, so total would read over most days.
function DayBars({ totals }) {
  const bars = dayBars(totals)
  const floorPct = (DAILY_TARGET.proteinMin / DAILY_TARGET.protein) * 100
  return (
    <div className="day-bars">
      {bars.map((b) => {
        const pct = Math.max(0, Math.min(100, (b.value / b.target) * 100))
        const state = b.kind === 'reach' ? (b.hit ? 'hit' : 'short') : b.over ? 'over' : 'under'
        return (
          <div key={b.key} className={`bar-row ${b.kind} ${state}`}>
            <span className="bar-label">{b.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${pct}%` }} />
              {b.kind === 'reach' && <span className="bar-tick" style={{ left: `${floorPct}%` }} />}
            </span>
            <span className="bar-val">
              {Math.round(b.value)}
              <span className="bar-target">/{b.target}</span>
            </span>
          </div>
        )
      })}
      <p className="bars-note">Daily target · protein to reach, the rest are ceilings</p>
    </div>
  )
}
