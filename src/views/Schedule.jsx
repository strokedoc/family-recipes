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
} from '../lib/planner.js'

export default function Schedule({ data, commit, openRecipe }) {
  const [weekStart, setWeekStart] = useState(() => weekStartOf())
  const [picker, setPicker] = useState(null) // { date, meal } | null

  const dates = weekDates(weekStart)
  const thisWeek = weekStartOf()

  function setMeal(date, meal, recipeId) {
    commit({ type: 'setMeal', date, meal, recipeId })
    setPicker(null)
  }

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
                        <button className="meal-slot empty" onClick={() => setPicker({ date, meal })}>
                          + add
                        </button>
                      )}
                      {recipe && (
                        <button
                          className="meal-clear"
                          aria-label={`Clear ${MEAL_LABELS[meal]}`}
                          onClick={() => setMeal(date, meal, null)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {picker && (
        <RecipePicker
          data={data}
          onPick={(id) => setMeal(picker.date, picker.meal, id)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
