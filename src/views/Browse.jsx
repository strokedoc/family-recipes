import React, { useMemo, useState } from 'react'
import { perServing, proteinDensity, fmt } from '../lib/nutrition.js'
import Icon from '../components/Icon.jsx'

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

export default function Browse({ data, sort, setSort, openRecipe }) {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState([])

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
        <div className="search-field">
          <Icon name="search" size={16} className="search-icon" />
          <input
            className="search"
            type="search"
            placeholder={`Search ${data.recipes.length} recipes`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sort-btn">
          <Icon name="sort" size={18} />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort recipes">
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="cat-tabs">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`cat-tab press ${category === c.id ? 'active' : ''}`}
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
              className={`tag-chip press ${activeTags.includes(t) ? 'active' : ''}`}
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
          <button key={recipe.id} className="rcard press" onClick={() => openRecipe(recipe.id)}>
            {/* The ring fills at 20 g protein per 100 kcal. */}
            <span
              className="ring"
              style={{ '--pct': `${Math.min(100, density * 5)}%` }}
              title="g protein per 100 kcal"
            >
              <span className="ring-inner">
                <span className="ring-figure">{fmt(density, 1)}</span>
                <span className="ring-micro">P/100</span>
              </span>
            </span>
            <span className="rcard-text">
              <span className="rcard-name">{recipe.name}</span>
              <span className="rcard-metrics">
                <span className="m-protein">
                  {fmt(macros.protein)}
                  <small> g P</small>
                </span>
                <span className="m-kcal">{fmt(macros.kcal)} kcal</span>
                <span className="m-servings">×{recipe.servings}</span>
              </span>
            </span>
          </button>
        ))}
        {shown.length === 0 && <div className="empty">Nothing matches — clear a filter?</div>}
      </div>
    </div>
  )
}
