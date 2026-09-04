import React, { useMemo, useState } from 'react'
import { perServing, fmt } from '../lib/nutrition.js'
import IngredientPicker from '../components/IngredientPicker.jsx'

const CATEGORIES = ['breakfast', 'lunch-dinner', 'snack', 'dessert']
const ROLES = [
  ['main', 'Main meal'],
  ['side', 'Side'],
  ['bread', 'Bread'],
  ['filler', 'Protein top-up'],
  ['constant', 'Daily breakfast'],
  ['dessert', 'Dessert'],
]
const PROTEIN_SOURCES = ['besan', 'chickpea', 'dal', 'paneer', 'soya', 'tofu', 'mixed']

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function RecipeEdit({ recipe, data, commit, showToast, onDone, onDeleted }) {
  const isNew = !recipe
  const [draft, setDraft] = useState(() =>
    recipe
      ? {
          ...recipe,
          ingredients: recipe.ingredients.map((i) => ({ ...i })),
          steps: [...recipe.steps],
          tags: [...(recipe.tags || [])],
        }
      : {
          id: '',
          name: '',
          category: 'lunch-dinner',
          role: 'main',
          proteinSource: '',
          servings: 2,
          yieldGramsCooked: null,
          ingredients: [],
          steps: [],
          tags: [],
          notes: '',
          source: 'app',
        },
  )
  const [picker, setPicker] = useState(null) // null | {mode:'add'} | {mode:'swap', index}
  const [stepsText, setStepsText] = useState(draft.steps.join('\n'))
  const [tagsText, setTagsText] = useState(draft.tags.join(', '))

  const preview = useMemo(() => {
    const r = { ...draft, servings: Number(draft.servings) || 1 }
    return perServing(r, data.ingredients)
  }, [draft, data])

  function setField(k, v) {
    setDraft((d) => ({ ...d, [k]: v }))
  }

  function setGrams(index, grams) {
    setDraft((d) => {
      const ings = d.ingredients.map((it, i) => (i === index ? { ...it, grams } : it))
      return { ...d, ingredients: ings }
    })
  }

  function setNote(index, note) {
    setDraft((d) => {
      const ings = d.ingredients.map((it, i) => (i === index ? { ...it, note: note || undefined } : it))
      return { ...d, ingredients: ings }
    })
  }

  function removeIngredient(index) {
    setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== index) }))
  }

  function onPicked(ref) {
    if (picker?.mode === 'swap') {
      setDraft((d) => ({
        ...d,
        ingredients: d.ingredients.map((it, i) => (i === picker.index ? { ...it, ref } : it)),
      }))
    } else {
      setDraft((d) => ({ ...d, ingredients: [...d.ingredients, { ref, grams: 100 }] }))
    }
    setPicker(null)
  }

  function save() {
    const name = draft.name.trim()
    if (!name) return showToast('Give it a name first')
    if (!draft.ingredients.length) return showToast('Add at least one ingredient')
    if (draft.ingredients.some((i) => !(Number(i.grams) > 0)))
      return showToast('Every ingredient needs grams')
    if (!(Number(draft.servings) > 0)) return showToast('Servings must be greater than zero')
    if (draft.yieldGramsCooked !== null && !(Number(draft.yieldGramsCooked) > 0))
      return showToast('Cooked weight must be greater than zero')
    if (draft.role === 'main' && !draft.proteinSource)
      return showToast('Choose the main protein source')
    let id = draft.id
    if (isNew) {
      id = slugify(name)
      if (!id) return showToast('Name needs some letters')
      while (data.recipes.some((r) => r.id === id)) id += '-2'
    }
    const clean = {
      ...draft,
      id,
      name,
      servings: Number(draft.servings) || 1,
      yieldGramsCooked: draft.yieldGramsCooked ? Number(draft.yieldGramsCooked) : null,
      ingredients: draft.ingredients.map((i) => ({ ...i, grams: Number(i.grams) })),
      steps: stepsText.split('\n').map((s) => s.trim()).filter(Boolean),
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      notes: draft.notes?.trim() || undefined,
    }
    if (clean.role !== 'main' || !clean.proteinSource) delete clean.proteinSource
    if (!clean.notes) delete clean.notes
    commit({ type: 'putRecipe', recipe: clean })
    onDone(id)
  }

  function remove() {
    if (!window.confirm(`Delete "${recipe.name}"? This commits the deletion for both of you.`)) return
    commit({ type: 'deleteRecipe', id: recipe.id })
    onDeleted()
  }

  return (
    <div className="edit">
      <div className="detail-nav">
        <button className="back-btn" onClick={() => (isNew ? onDeleted() : onDone(recipe.id))}>
          ← Cancel
        </button>
        <button className="primary-btn" onClick={save}>
          {isNew ? 'Add recipe' : 'Save'}
        </button>
      </div>

      <h1 className="detail-title">{isNew ? 'New recipe' : `Edit: ${recipe.name}`}</h1>

      <label className="field">
        <span>Name</span>
        <input value={draft.name} onChange={(e) => setField('name', e.target.value)} />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Category</span>
          <select value={draft.category} onChange={(e) => setField('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Servings</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={draft.servings}
            onChange={(e) => setField('servings', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Cooked wt (g)</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="weigh pot"
            value={draft.yieldGramsCooked ?? ''}
            onChange={(e) => setField('yieldGramsCooked', e.target.value || null)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Planner use</span>
          <select value={draft.role || ''} onChange={(e) => setField('role', e.target.value)}>
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {draft.role === 'main' && (
          <label className="field">
            <span>Main protein</span>
            <select
              value={draft.proteinSource || ''}
              onChange={(e) => setField('proteinSource', e.target.value)}
            >
              <option value="">Choose…</option>
              {PROTEIN_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <h2 className="section-title">Ingredients</h2>
      <div className="live-preview">
        per serving: {fmt(preview.kcal)} kcal · P{fmt(preview.protein)} / C{fmt(preview.carbs)} / F
        {fmt(preview.fat)}
      </div>
      <ul className="edit-ing-list">
        {draft.ingredients.map((item, i) => {
          const ing = data.ingredients[item.ref]
          return (
            <li key={i} className="edit-ing-row">
              <input
                className="grams-input"
                type="number"
                inputMode="numeric"
                min="0"
                value={item.grams}
                onChange={(e) => setGrams(i, e.target.value)}
              />
              <div className="edit-ing-mid">
                <button className="swap-btn" onClick={() => setPicker({ mode: 'swap', index: i })}>
                  {ing ? ing.name : item.ref} ↺
                </button>
                <input
                  className="note-input"
                  placeholder="note (e.g. dry weight)"
                  value={item.note || ''}
                  onChange={(e) => setNote(i, e.target.value)}
                />
              </div>
              <button className="remove-btn" onClick={() => removeIngredient(i)} aria-label="Remove">
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      <button className="secondary-btn" onClick={() => setPicker({ mode: 'add' })}>
        + Add ingredient
      </button>

      <label className="field">
        <span>Steps (one per line)</span>
        <textarea rows="5" value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
      </label>

      <label className="field">
        <span>Tags (comma-separated)</span>
        <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea rows="2" value={draft.notes || ''} onChange={(e) => setField('notes', e.target.value)} />
      </label>

      {!isNew && (
        <button className="danger-btn" onClick={remove}>
          Delete recipe
        </button>
      )}

      {picker && (
        <IngredientPicker
          ingredients={data.ingredients}
          onPick={onPicked}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
