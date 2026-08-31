import React, { useState } from 'react'
import RecipePicker from '../components/RecipePicker.jsx'
import {
  MEALS,
  MEAL_LABELS,
  weekStartOf,
  weekDates,
  addDays,
  dayLabel,
  weekRangeLabel,
  isToday,
  autoFillWeek,
} from '../lib/planner.js'

export default function Schedule({ data, commit, openRecipe, showToast }) {
  const [weekStart, setWeekStart] = useState(() => weekStartOf())
  // sheet: null | {mode:'single', date, meal} | {mode:'multi'} | {mode:'move', date, meal, recipeId}
  const [sheet, setSheet] = useState(null)

  const dates = weekDates(weekStart)
  const thisWeek = weekStartOf()

  function setMeal(date, meal, recipeId) {
    commit({ type: 'setMeal', date, meal, recipeId })
    setSheet(null)
  }

  function autoFill(ids) {
    const { ops, placed, skipped } = autoFillWeek(data, weekStart, ids)
    ops.forEach((op) => commit({ type: 'setMeal', ...op }))
    setSheet(null)
    if (showToast) {
      showToast(
        skipped
          ? `Added ${placed} — ${skipped} didn't fit (week's full).`
          : `Added ${placed} recipe${placed === 1 ? '' : 's'} across the week.`,
      )
    }
  }

  function move(toDate, toMeal) {
    const { date: fromDate, meal: fromMeal, recipeId } = sheet
    if (toDate === fromDate && toMeal === fromMeal) return setSheet(null)
    const occupant = data.schedule?.[toDate]?.[toMeal] || null
    commit({ type: 'setMeal', date: toDate, meal: toMeal, recipeId })
    commit({ type: 'setMeal', date: fromDate, meal: fromMeal, recipeId: occupant })
    setSheet(null)
  }

  function clearWeek() {
    if (!window.confirm(`Clear every meal for ${weekRangeLabel(weekStart)}?`)) return
    for (const date of dates) {
      const day = data.schedule?.[date] || {}
      for (const meal of MEALS) {
        if (day[meal]) commit({ type: 'setMeal', date, meal, recipeId: null })
      }
    }
  }

  const moving = sheet?.mode === 'move' ? data.recipes.find((r) => r.id === sheet.recipeId) : null

  return (
    <div className="schedule">
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
              Today
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

      <div className="plan-bar">
        <button className="autofill-btn" onClick={() => setSheet({ mode: 'multi' })}>
          ✨ Add recipes to week
        </button>
        <button className="link-btn" onClick={clearWeek}>
          Clear week
        </button>
      </div>

      <div className="day-list">
        {dates.map((date) => {
          const day = data.schedule?.[date] || {}
          return (
            <div key={date} className={`day-card ${isToday(date) ? 'today' : ''}`}>
              <div className="day-head">
                <span className="day-weekday">{dayLabel(date).weekday}</span>
                <span className="day-date">{dayLabel(date).date}</span>
              </div>
              <div className="meal-rows">
                {MEALS.map((meal) => {
                  const recipeId = day[meal]
                  const recipe = recipeId ? data.recipes.find((r) => r.id === recipeId) : null
                  return (
                    <div key={meal} className="meal-row">
                      <span className="meal-label">{MEAL_LABELS[meal]}</span>
                      {recipe ? (
                        <button className="meal-slot filled" onClick={() => openRecipe(recipe.id)}>
                          {recipe.name}
                        </button>
                      ) : (
                        <button
                          className="meal-slot empty"
                          onClick={() => setSheet({ mode: 'single', date, meal })}
                        >
                          + add
                        </button>
                      )}
                      {recipe && (
                        <>
                          <button
                            className="meal-move"
                            aria-label={`Move ${recipe.name}`}
                            onClick={() => setSheet({ mode: 'move', date, meal, recipeId })}
                          >
                            ⤢
                          </button>
                          <button
                            className="meal-clear"
                            aria-label={`Clear ${MEAL_LABELS[meal]}`}
                            onClick={() => setMeal(date, meal, null)}
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {sheet?.mode === 'single' && (
        <RecipePicker
          data={data}
          onPick={(id) => setMeal(sheet.date, sheet.meal, id)}
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

      {sheet?.mode === 'move' && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="sheet-title">Move “{moving?.name}”</span>
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
                      const occ = data.schedule?.[date]?.[meal]
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
