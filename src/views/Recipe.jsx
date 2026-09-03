import React, { useMemo, useState } from 'react'
import {
  perServing,
  perGrams,
  recipeTotals,
  proteinDensity,
  fmt,
  cronometerLine,
} from '../lib/nutrition.js'

export default function Recipe({ recipe, data, commit, showToast, onEdit, onBack }) {
  const serving = useMemo(() => perServing(recipe, data.ingredients), [recipe, data])
  const totals = useMemo(() => recipeTotals(recipe, data.ingredients), [recipe, data])
  const density = proteinDensity(serving)

  const defaultPortion = recipe.yieldGramsCooked
    ? Math.round(recipe.yieldGramsCooked / recipe.servings / 5) * 5
    : 0
  const [portion, setPortion] = useState(defaultPortion)
  const portionMacros = recipe.yieldGramsCooked
    ? perGrams(recipe, data.ingredients, portion)
    : null

  async function copyMacros() {
    const line = portionMacros
      ? cronometerLine(recipe.name, portion, portionMacros)
      : cronometerLine(recipe.name, null, serving)
    try {
      await navigator.clipboard.writeText(line)
      showToast(`Copied: ${line}`)
    } catch {
      showToast('Copy failed — long-press to copy manually: ' + line)
    }
  }

  function setYield() {
    const raw = window.prompt('Cooked weight of the whole pot, in grams:', recipe.yieldGramsCooked || '')
    if (raw === null) return
    const g = Math.round(Number(raw))
    if (!g || g <= 0) return showToast('Enter a weight in grams, e.g. 1240')
    commit({ type: 'putRecipe', recipe: { ...recipe, yieldGramsCooked: g } })
    setPortion(Math.round(g / recipe.servings / 5) * 5)
  }

  return (
    <article className="detail">
      <div className="detail-nav">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <button className="edit-btn" onClick={onEdit}>
          Edit
        </button>
      </div>

      <h1 className="detail-title">{recipe.name}</h1>
      <div className="detail-meta">
        <span>makes {recipe.servings}</span>
        {recipe.tags?.map((t) => (
          <span key={t} className="tag-static">
            {t}
          </span>
        ))}
      </div>

      <section className="macro-panel">
        <div className="macro-grid">
          <MacroCell label="kcal" value={fmt(serving.kcal)} big />
          <MacroCell label="protein" value={`${fmt(serving.protein)}g`} big accent />
          <MacroCell label="carbs" value={`${fmt(serving.carbs)}g`} />
          <MacroCell label="fat" value={`${fmt(serving.fat)}g`} />
          <MacroCell label="fiber" value={`${fmt(serving.fiber)}g`} />
          <MacroCell label="P/100kcal" value={fmt(density, 1)} />
        </div>
        <div className="macro-caption">per serving (1 of {recipe.servings})</div>
      </section>

      <section className="portion-panel">
        <h2 className="section-title">Portion</h2>
        {recipe.yieldGramsCooked ? (
          <>
            <div className="portion-readout">
              <input
                className="portion-input"
                type="number"
                inputMode="numeric"
                min="0"
                value={portion}
                onChange={(e) => setPortion(Number(e.target.value) || 0)}
              />
              <span className="portion-unit">g on the scale</span>
              <span className="portion-macros">
                = {fmt(portionMacros.kcal)} kcal · {fmt(portionMacros.protein)} g protein
              </span>
            </div>
            <input
              className="portion-slider"
              type="range"
              min="25"
              max={recipe.yieldGramsCooked}
              step="5"
              value={Math.min(portion, recipe.yieldGramsCooked)}
              onChange={(e) => setPortion(Number(e.target.value))}
            />
            <div className="portion-footnote">
              whole pot: {recipe.yieldGramsCooked} g ·{' '}
              <button className="link-btn" onClick={setYield}>
                re-weigh
              </button>
            </div>
          </>
        ) : (
          <div className="yield-nudge">
            <p>
              Weigh the pot next cook to unlock gram-level portions — for now the numbers above are
              per serving.
            </p>
            <button className="secondary-btn" onClick={setYield}>
              I weighed it — set cooked weight
            </button>
          </div>
        )}
        <button className="primary-btn copy-btn" onClick={copyMacros}>
          Copy for Cronometer
        </button>
      </section>

      <section>
        <h2 className="section-title">Ingredients</h2>
        <ul className="ing-list">
          {recipe.ingredients.map((item, i) => {
            const ing = data.ingredients[item.ref]
            return (
              <li key={i} className="ing-row">
                <span className="ing-grams">{item.grams} g</span>
                <span className="ing-name">
                  {ing ? ing.name : item.ref}
                  {item.note && <em className="ing-note"> — {item.note}</em>}
                </span>
                <span className="ing-kcal">
                  {ing ? `${fmt((item.grams * ing.per100g.kcal) / 100)} kcal` : ''}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="totals-line">
          whole recipe: {fmt(totals.kcal)} kcal · {fmt(totals.protein)} g protein
        </div>
      </section>

      <section>
        <h2 className="section-title">Steps</h2>
        <ol className="steps">
          {recipe.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </section>

      {recipe.notes && <div className="notes">✎ {recipe.notes}</div>}
    </article>
  )
}

function MacroCell({ label, value, big, accent }) {
  return (
    <div className={`macro-cell ${big ? 'big' : ''} ${accent ? 'accent' : ''}`}>
      <span className="macro-value">{value}</span>
      <span className="macro-label">{label}</span>
    </div>
  )
}
