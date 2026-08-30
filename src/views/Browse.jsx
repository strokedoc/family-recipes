import React, { useMemo, useState } from 'react'
import { perServing, proteinDensity, fmt } from '../lib/nutrition.js'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch-dinner', label: 'Lunch · Dinner' },
  { id: 'snack', label: 'Snacks' },
  { id: 'dessert', label: 'Desserts' },
]

const SORTS = [
  { id: 'density', label: 'Protein per 100 kcal' },
  { id: 'protein', label: 'Most protein' },
  { id: 'kcal', label: 'Lightest' },
  { id: 'name', label: 'A–Z' },
]

export default function Browse({ data, openRecipe, setNav }) {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const [sort, setSort] = useState('density')

  const enriched = useMemo(
    () =>
      data.recipes.map((r) => {
        const macros = perServing(r, data.ingredients)
        return { recipe: r, macros, density: proteinDensity(macros) }
      }),
    [data],
  )

  const allTags = useMemo(() => {
    const counts = {}
    for (const { recipe } of enriched) {
      if (category !== 'all' && recipe.category !== category) continue
      for (const t of recipe.tags || []) counts[t] = (counts[t] || 0) + 1
    }
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  }, [enriched, category])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = enriched.filter(({ recipe }) => {
      if (category !== 'all' && recipe.category !== category) return false
      if (activeTags.length && !activeTags.every((t) => recipe.tags?.includes(t))) return false
      if (q && !recipe.name.toLowerCase().includes(q) && !recipe.tags?.some((t) => t.includes(q)))
        return false
      return true
    })
    const by = {
      density: (a, b) => b.density - a.density,
      protein: (a, b) => b.macros.protein - a.macros.protein,
      kcal: (a, b) => a.macros.kcal - b.macros.kcal,
      name: (a, b) => a.recipe.name.localeCompare(b.recipe.name),
    }
    return list.sort(by[sort])
  }, [enriched, category, query, activeTags, sort])

  return (
    <div className="browse">
      <div className="search-row">
        <input
          className="search"
          type="search"
          placeholder="Search recipes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <nav className="cat-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`cat-tab ${category === c.id ? 'active' : ''}`}
            onClick={() => {
              setCategory(c.id)
              setActiveTags([])
            }}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {allTags.length > 0 && (
        <div className="tag-row">
          {allTags.map((t) => (
            <button
              key={t}
              className={`tag-chip ${activeTags.includes(t) ? 'active' : ''}`}
              onClick={() =>
                setActiveTags((cur) =>
                  cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t],
                )
              }
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="cards">
        {shown.map(({ recipe, macros, density }) => (
          <button key={recipe.id} className="card" onClick={() => openRecipe(recipe.id)}>
            <div className="card-top">
              <h3 className="card-name">{recipe.name}</h3>
              <span className="density-badge" title="g protein per 100 kcal">
                {fmt(density, 1)}
                <small>P/100</small>
              </span>
            </div>
            <div className="card-macros">
              <span className="macro-kcal">{fmt(macros.kcal)} kcal</span>
              <span className="macro-protein">{fmt(macros.protein)} g protein</span>
              <span className="card-serving">per serving · makes {recipe.servings}</span>
            </div>
          </button>
        ))}
        {shown.length === 0 && <div className="empty">Nothing matches — clear a filter?</div>}
      </div>

      <button className="fab" onClick={() => setNav({ view: 'new' })} aria-label="Add recipe">
        + Recipe
      </button>
    </div>
  )
}
