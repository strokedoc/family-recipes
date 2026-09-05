import React, { useEffect, useMemo, useRef, useState } from 'react'
import RecipePicker from '../components/RecipePicker.jsx'
import {
  MEALS,
  MEAL_LABELS,
  slotIds,
  toISODate,
  weekDates,
  addDays,
  weekStartOf,
  dayLabel,
  weekRangeLabel,
  isToday,
  autoFillWeek,
} from '../lib/planner.js'
import { perServing } from '../lib/nutrition.js'
import { buildDay, dayTotals, dayBars, swapOptions, DAILY_TARGET } from '../lib/scheduler.js'
import { balanceRecipes } from '../lib/balancer.js'
import { applyOp } from '../lib/store.js'

const emptyMacros = () => ({ kcal: '', protein: '', netCarbs: '', fat: '' })
const TODAY_MACROS_KEY = 'rasoi.macros.today'
const TARGET_KCAL_KEY = 'rasoi.target.kcal'
// The shared plan is the default; the slider only moves the calorie ceiling the
// balancer scores against, so a heavier or lighter day doesn't need new recipes.
const TARGET_MIN = 1000
const TARGET_MAX = 2500
const TARGET_STEP = 50

function loadTargetKcal() {
  const saved = Number(localStorage.getItem(TARGET_KCAL_KEY))
  return saved >= TARGET_MIN && saved <= TARGET_MAX ? saved : DAILY_TARGET.kcal
}

function loadTodayMacros(date) {
  try {
    const saved = JSON.parse(localStorage.getItem(TODAY_MACROS_KEY))
    return saved?.date === date ? saved.macros : emptyMacros()
  } catch {
    return emptyMacros()
  }
}

export default function Schedule({ data, commit, openRecipe, showToast, weekStart, setWeekStart }) {
  const today = toISODate(new Date())
  const [balancerOpen, setBalancerOpen] = useState(false)
  const [todayMacros, setTodayMacros] = useState(() => loadTodayMacros(today))
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [picked, setPicked] = useState(null)
  // sheet: null | {mode:'single'|'add', date, meal} | {mode:'multi'}
  //             | {mode:'move', date, meal} | {mode:'swap', date, meal, recipeId}
  const [sheet, setSheet] = useState(null)
  const selectedPill = useRef(null)

  const dates = weekDates(weekStart)
  const thisWeek = weekStartOf()
  // One day at a time. Today when it's in view, otherwise the week's Monday.
  const date = picked && dates.includes(picked) ? picked : dates.includes(today) ? today : dates[0]

  // Keep the focused day in view when the week (or the day) changes.
  useEffect(() => {
    selectedPill.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [date])

  const dayIsEmpty = (d) => MEALS.every((m) => slotIds(data.schedule?.[d]?.[m]).length === 0)

  // The strip's status dots need a protein total for every day in the week.
  const weekProtein = useMemo(
    () => Object.fromEntries(dates.map((d) => [d, dayTotals(data, data.schedule?.[d] || {}).protein])),
    [data, dates],
  )

  const day = data.schedule?.[date] || {}
  const totals = dayTotals(data, day)
  const bars = dayBars(totals)
  const proteinBar = bars.find((b) => b.key === 'protein')
  const ceilings = bars.filter((b) => b.kind === 'ceiling')

  function setSlot(d, meal, ids) {
    commit({ type: 'setMeal', date: d, meal, recipeId: ids })
    setSheet(null)
  }

  function addToSlot(d, meal, id) {
    const current = slotIds(data.schedule?.[d]?.[meal])
    if (current.includes(id)) {
      setSheet(null)
      return showToast?.('That recipe is already in this meal.')
    }
    setSlot(d, meal, [...current, id])
  }

  function removeFromSlot(d, meal, id) {
    setSlot(d, meal, slotIds(data.schedule?.[d]?.[meal]).filter((x) => x !== id))
  }

  function swapIn(newId) {
    const { date: d, meal, recipeId } = sheet
    setSlot(d, meal, slotIds(data.schedule?.[d]?.[meal]).map((x) => (x === recipeId ? newId : x)))
  }

  // One click: build a balanced day and drop it in as a single edit.
  function fillDay(d) {
    if (!dayIsEmpty(d) && !window.confirm(`Replace everything scheduled for ${dayLabel(d).date}?`))
      return
    const { slots, warnings } = buildDay(data, d)
    if (!slots.lunch.length) return showToast?.(warnings[0] || 'Could not build that day.')
    commit({ type: 'setDay', date: d, slots })
    if (warnings.length) showToast?.(warnings[0])
  }

  // Fill every empty day in the week. Each day is built against the days already
  // placed, so the 7-day variety rule still applies within the run.
  function fillWeek() {
    let working = data
    let placed = 0
    let empty = 0
    let failed = 0
    const warned = []
    for (const d of dates) {
      if (!MEALS.every((m) => slotIds(working.schedule?.[d]?.[m]).length === 0)) continue
      empty++
      const { slots, warnings } = buildDay(working, d)
      if (!slots.lunch.length) {
        failed++
        continue
      }
      const op = { type: 'setDay', date: d, slots }
      commit(op)
      working = applyOp(working, op)
      placed++
      if (warnings.length) warned.push(dayLabel(d).weekday)
    }
    if (!empty) return showToast?.('Every day this week already has something scheduled.')
    if (!placed) return showToast?.('Could not build a day with the current planner recipes.')
    showToast?.(
      warned.length
        ? `Filled ${placed} day${placed === 1 ? '' : 's'} — ${warned.join(', ')} fell outside the protein range.`
        : failed
          ? `Filled ${placed} day${placed === 1 ? '' : 's'}; ${failed} could not be built.`
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
    for (const d of dates) {
      const scheduled = data.schedule?.[d] || {}
      for (const meal of MEALS) {
        if (slotIds(scheduled[meal]).length)
          commit({ type: 'setMeal', date: d, meal, recipeId: null })
      }
    }
  }

  const swapping = sheet?.mode === 'swap' ? data.recipes.find((r) => r.id === sheet.recipeId) : null
  const label = dayLabel(date)

  return (
    <div className="schedule">
      {/* The header names the week, so the arrows sit on the strip itself. */}
      <div className="strip-row">
        <button
          className="icon-btn press"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          aria-label="Previous week"
        >
          ‹
        </button>
        <div className="day-strip">
        {dates.map((d) => {
          const p = weekProtein[d]
          const dot = p >= DAILY_TARGET.proteinMin ? 'hit' : p > 0 ? 'part' : ''
          return (
            <button
              key={d}
              ref={d === date ? selectedPill : null}
              className={`day-pill press ${d === date ? 'sel' : ''}`}
              aria-pressed={d === date}
              onClick={() => setPicked(d)}
            >
              <span className="day-pill-wd">{dayLabel(d).weekday}</span>
              <span className="day-pill-date">{dayLabel(d).date.split(' ')[1]}</span>
              <span className={`day-dot ${dot}`} />
            </button>
          )
          })}
        </div>
        <button
          className="icon-btn press"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      <div className="plan-bar">
        <button className="autofill-btn press" onClick={() => fillDay(date)}>
          {dayIsEmpty(date) ? '✨ Fill this day' : '↻ Rebuild this day'}
        </button>
        {weekStart !== thisWeek && (
          <button className="quiet-btn" onClick={() => setWeekStart(thisWeek)}>
            Back to today
          </button>
        )}
      </div>
      <div className="week-actions">
        <button className="quiet-btn" onClick={fillWeek}>
          Fill week
        </button>
        <button className="quiet-btn" onClick={() => setSheet({ mode: 'multi' })}>
          Add specific
        </button>
        <button className="quiet-btn" onClick={clearWeek}>
          Clear week
        </button>
      </div>

      {/* Protein is the floor to clear; calories, net carbs and fat are ceilings. */}
      <section className="day-total">
        <div className="day-total-head">
          <span className="card-label">Day total</span>
          <span className="day-total-date">
            {label.weekday}, {label.date}
            {isToday(date) ? ' · today' : ''}
          </span>
        </div>
        <div className="day-total-body">
          <span
            className="dial"
            style={{
              '--pct': `${Math.min(100, (totals.protein / DAILY_TARGET.protein) * 100)}%`,
              '--dial-color': proteinBar.hit ? 'var(--olive)' : 'var(--amber)',
            }}
          >
            <span className="dial-inner">
              <span className="dial-figure">{Math.round(totals.protein)}</span>
              <span className="dial-label">G PROTEIN</span>
            </span>
          </span>
          <div className="ceilings">
            {ceilings.map((b) => (
              <div key={b.key} className={`ceiling ${b.over ? 'over' : ''}`}>
                <div className="ceiling-head">
                  <span>{b.label}</span>
                  <span className="ceiling-val">
                    {Math.round(b.value)}/{b.target}
                  </span>
                </div>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{ width: `${Math.min(100, (b.value / b.target) * 100)}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="day-total-note">
          Protein is the floor to clear — {DAILY_TARGET.proteinMin} g minimum. The rest are ceilings.
        </p>
      </section>

      <MacroBalancer
        date={today}
        open={balancerOpen}
        setOpen={setBalancerOpen}
        macros={todayMacros}
        setMacros={setTodayMacros}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        data={data}
        openRecipe={openRecipe}
      />

      {MEALS.map((meal) => {
        const ids = slotIds(day[meal])
        const mealProtein = ids.reduce((sum, id) => {
          const r = data.recipes.find((x) => x.id === id)
          return sum + (r ? perServing(r, data.ingredients).protein : 0)
        }, 0)
        return (
          <section key={meal} className="meal-card">
            <div className="meal-head">
              <span className="meal-label">{MEAL_LABELS[meal]}</span>
              <span className="meal-rule" />
              <span className="meal-total">{ids.length ? `${Math.round(mealProtein)} g P` : '—'}</span>
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
            {ids.map((id) => {
              const r = data.recipes.find((x) => x.id === id)
              const p = r ? Math.round(perServing(r, data.ingredients).protein) : 0
              return (
                <div key={id} className="meal-item">
                  <span className="meal-bullet" />
                  <button
                    className="meal-item-name"
                    title="Tap to swap for something similar"
                    onClick={() => setSheet({ mode: 'swap', date, meal, recipeId: id })}
                  >
                    {r ? r.name : id}
                  </button>
                  <span className="meal-item-p">{p}g</span>
                  <button
                    className="meal-item-x"
                    aria-label={`Remove ${r?.name || id}`}
                    onClick={() => removeFromSlot(date, meal, id)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
            <button className="meal-add press" onClick={() => setSheet({ mode: 'add', date, meal })}>
              + Add
            </button>
          </section>
        )
      })}

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
              {dates.map((d) => (
                <div key={d} className="move-day">
                  <span className="move-day-label">
                    {dayLabel(d).weekday} {dayLabel(d).date}
                  </span>
                  <div className="move-slots">
                    {MEALS.map((meal) => {
                      const occ = slotIds(data.schedule?.[d]?.[meal]).length
                      const here = d === sheet.date && meal === sheet.meal
                      return (
                        <button
                          key={meal}
                          className={`move-slot ${occ ? 'occ' : ''} ${here ? 'here' : ''}`}
                          disabled={here}
                          title={MEAL_LABELS[meal]}
                          onClick={() => move(d, meal)}
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

function MacroBalancer({
  date,
  open,
  setOpen,
  macros,
  setMacros,
  showSuggestions,
  setShowSuggestions,
  data,
  openRecipe,
}) {
  const [targetKcal, setTargetKcal] = useState(loadTargetKcal)
  const target = { ...DAILY_TARGET, kcal: targetKcal }
  const suggestions = showSuggestions ? balanceRecipes(data, macros, { target }) : []
  const protein = Number(macros.protein) || 0

  function updateTarget(value) {
    const next = Number(value)
    setTargetKcal(next)
    localStorage.setItem(TARGET_KCAL_KEY, String(next))
  }

  function update(key, value) {
    const next = { ...macros, [key]: value }
    setMacros(next)
    localStorage.setItem(TODAY_MACROS_KEY, JSON.stringify({ date, macros: next }))
  }

  function clear() {
    const next = emptyMacros()
    setMacros(next)
    setShowSuggestions(false)
    localStorage.removeItem(TODAY_MACROS_KEY)
  }

  return (
    <section className={`macro-balancer ${open ? 'open' : ''}`}>
      <button
        className="balancer-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>
          <strong>Balance today</strong>
          <small>Enter totals so far</small>
        </span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="balancer-body">
          <div className="macro-entry-grid">
            {[
              ['kcal', 'Calories'],
              ['protein', 'Protein (g)'],
              ['netCarbs', 'Net carbs (g)'],
              ['fat', 'Fat (g)'],
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={macros[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="target-slider">
            <div className="target-head">
              <span>Target calories</span>
              <span className="target-val">
                {targetKcal} kcal
                {targetKcal !== DAILY_TARGET.kcal && (
                  <button className="quiet-btn" onClick={() => updateTarget(DAILY_TARGET.kcal)}>
                    Reset
                  </button>
                )}
              </span>
            </div>
            <input
              type="range"
              min={TARGET_MIN}
              max={TARGET_MAX}
              step={TARGET_STEP}
              value={targetKcal}
              onChange={(event) => updateTarget(event.target.value)}
              aria-label="Target calories"
            />
          </div>
          <p className="balancer-privacy">
            Saved only on this device—not added to the shared recipe file.
          </p>
          <div className="balancer-actions">
            <button className="primary-btn" onClick={() => setShowSuggestions(true)}>
              Find best fits
            </button>
            <button className="link-btn" onClick={clear}>
              Clear
            </button>
          </div>

          {showSuggestions && (
            <div className="suggestion-list">
              <p className="suggestion-summary">
                {protein >= DAILY_TARGET.proteinMin
                  ? 'Protein is already in the good range. Best fits within the remaining macros:'
                  : `Best one-serving fits toward ${targetKcal} kcal and ${DAILY_TARGET.proteinAim}–${DAILY_TARGET.protein} g protein:`}
              </p>
              {suggestions.map((item, index) => (
                <button
                  key={item.recipe.id}
                  className="suggestion-card press"
                  onClick={() => openRecipe(item.recipe.id)}
                >
                  <span className="suggestion-topline">
                    <strong>{item.recipe.name}</strong>
                    {index === 0 && <small>Best fit</small>}
                  </span>
                  <span className="suggestion-adds">
                    Adds {Math.round(item.macros.kcal)} kcal · {Math.round(item.macros.protein)} g protein
                  </span>
                  <span className="suggestion-after">
                    After: {Math.round(item.after.kcal)}/{targetKcal} kcal ·{' '}
                    {Math.round(item.after.protein)}/{DAILY_TARGET.protein} g protein ·{' '}
                    {Math.round(item.after.netCarbs)}/{DAILY_TARGET.netCarbs} g net carbs ·{' '}
                    {Math.round(item.after.fat)}/{DAILY_TARGET.fat} g fat
                  </span>
                </button>
              ))}
              <p className="balancer-privacy">Tap a suggestion to open the recipe.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function fmtDelta(n) {
  const v = Math.round(n)
  return v > 0 ? `+${v}` : `${v}`
}
