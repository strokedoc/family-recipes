// One-shot 2026-08-30 database expansion: ~60 ingredient-library additions
// (Indian home-kitchen base) + 11 protein-forward recipes around besan, tofu,
// paneer, and Greek yogurt. Per-100g values are USDA FoodData Central /
// IFCT-style planning estimates — calibratable in the app's Library by design.
// Idempotent: skips anything already present. Run: node scripts/expand-db.mjs
import { readFileSync, writeFileSync } from 'fs'

const path = new URL('../public/data/recipes.json', import.meta.url)
const db = JSON.parse(readFileSync(path))
const NOW = '2026-08-30T00:00:00Z'

const I = (name, kcal, protein, carbs, fat, fiber, tags, note) => {
  const e = { name, per100g: { kcal, protein, carbs, fat, fiber }, tags }
  if (note) e.note = note
  return e
}

const newIngredients = {
  // aromatics & fresh flavor (the "how was garlic missing" section)
  garlic: I('Garlic', 149, 6.4, 33, 0.5, 2.1, ['veg', 'aromatic']),
  ginger: I('Ginger', 80, 1.8, 18, 0.8, 2, ['veg', 'aromatic']),
  'green-chili': I('Green chili', 40, 1.9, 8.8, 0.4, 1.5, ['veg', 'aromatic']),
  'coriander-leaves': I('Coriander leaves (fresh)', 23, 2.1, 3.7, 0.5, 2.8, ['veg', 'aromatic']),
  // vegetables
  cucumber: I('Cucumber', 15, 0.7, 3.6, 0.1, 0.5, ['veg']),
  carrot: I('Carrot', 41, 0.9, 9.6, 0.2, 2.8, ['veg']),
  cauliflower: I('Cauliflower', 25, 1.9, 5, 0.3, 2, ['veg']),
  cabbage: I('Cabbage', 25, 1.3, 5.8, 0.1, 2.5, ['veg']),
  potato: I('Potato', 77, 2, 17, 0.1, 2.2, ['veg']),
  'sweet-potato': I('Sweet potato', 86, 1.6, 20, 0.1, 3, ['veg']),
  lauki: I('Lauki (bottle gourd)', 14, 0.6, 3.4, 0, 0.5, ['veg']),
  bhindi: I('Bhindi (okra)', 33, 1.9, 7.5, 0.2, 3.2, ['veg']),
  'methi-leaves': I('Methi leaves (fresh fenugreek)', 49, 4.4, 6, 0.9, 1.1, ['veg']),
  'green-beans': I('Green beans', 31, 1.8, 7, 0.2, 2.7, ['veg']),
  broccoli: I('Broccoli', 34, 2.8, 6.6, 0.4, 2.6, ['veg']),
  mushroom: I('Mushrooms, white', 22, 3.1, 3.3, 0.3, 1, ['veg']),
  zucchini: I('Zucchini', 17, 1.2, 3.1, 0.3, 1, ['veg']),
  'corn-kernels': I('Corn kernels', 86, 3.3, 19, 1.4, 2, ['veg']),
  beetroot: I('Beetroot', 43, 1.6, 9.6, 0.2, 2.8, ['veg']),
  // fruit
  banana: I('Banana', 89, 1.1, 23, 0.3, 2.6, ['fruit']),
  apple: I('Apple', 52, 0.3, 14, 0.2, 2.4, ['fruit']),
  mango: I('Mango', 60, 0.8, 15, 0.4, 1.6, ['fruit']),
  pomegranate: I('Pomegranate arils', 83, 1.7, 19, 1.2, 4, ['fruit']),
  // nuts & seeds
  almonds: I('Almonds', 579, 21, 22, 50, 12.5, ['nut']),
  cashews: I('Cashews', 553, 18, 30, 44, 3.3, ['nut']),
  walnuts: I('Walnuts', 654, 15, 14, 65, 6.7, ['nut']),
  'flax-seeds': I('Flax seeds', 534, 18, 29, 42, 27, ['seed']),
  'pumpkin-seeds': I('Pumpkin seeds', 559, 30, 11, 49, 6, ['seed', 'protein-anchor']),
  'sesame-seeds': I('Sesame seeds (til)', 573, 18, 23, 50, 12, ['seed']),
  raisins: I('Raisins', 299, 3.1, 79, 0.5, 3.7, ['fruit']),
  // sweeteners
  jaggery: I('Jaggery (gor)', 383, 0.4, 98, 0.1, 0, ['sweetener']),
  sugar: I('Sugar', 387, 0, 100, 0, 0, ['sweetener']),
  honey: I('Honey', 304, 0.3, 82, 0, 0, ['sweetener']),
  // grains & flours (dry)
  'rice-basmati-dry': I('Basmati rice (dry)', 356, 8, 78, 0.6, 1.3, ['grain']),
  'brown-rice-dry': I('Brown rice (dry)', 370, 7.9, 77, 2.9, 3.5, ['grain']),
  'quinoa-dry': I('Quinoa (dry)', 368, 14, 64, 6, 7, ['grain', 'protein-anchor']),
  'rava-sooji': I('Rava / sooji (semolina)', 360, 12, 73, 1.1, 3.9, ['grain']),
  'jowar-flour': I('Jowar (sorghum) flour', 359, 8.4, 77, 3.3, 6.6, ['flour']),
  'bajra-flour': I('Bajra (pearl millet) flour', 378, 11, 73, 4.3, 8.5, ['flour']),
  'ragi-flour': I('Ragi (finger millet) flour', 328, 7.3, 72, 1.9, 11.2, ['flour']),
  'rice-flour': I('Rice flour', 366, 6, 80, 1.4, 2.4, ['flour']),
  'bread-whole-wheat': I('Bread, whole wheat', 252, 12.3, 43, 3.5, 6.8, ['grain'], '1 slice ≈ 32 g'),
  // dals & legumes (dry)
  'masoor-dal-dry': I('Masoor dal (dry)', 352, 24, 63, 1.1, 11, ['dal']),
  'chana-dal-dry': I('Chana dal (dry)', 360, 22, 60, 5, 12, ['dal']),
  'urad-dal-dry': I('Urad dal (dry)', 341, 25, 59, 1.6, 18, ['dal']),
  'rajma-dry': I('Rajma / kidney beans (dry)', 333, 24, 60, 0.8, 25, ['legume']),
  'kala-chana-dry': I('Kala chana (dry)', 364, 20, 61, 6, 17, ['legume']),
  'roasted-chana': I('Roasted chana (snack)', 387, 19, 61, 6, 17, ['legume', 'protein-anchor']),
  makhana: I('Makhana (fox nuts)', 347, 9.7, 77, 0.1, 14.5, ['grain', 'snack']),
  // dairy & soy
  'milk-whole': I('Milk, whole', 61, 3.2, 4.8, 3.3, 0, ['dairy']),
  'milk-skim': I('Milk, skim', 34, 3.4, 5, 0.1, 0, ['dairy']),
  'dahi-whole': I('Dahi (whole-milk yogurt)', 61, 3.5, 4.7, 3.3, 0, ['dairy']),
  'cheese-processed': I('Cheese, processed (Amul-style)', 300, 18, 4, 24, 0, ['dairy'], '1 slice ≈ 20 g'),
  butter: I('Butter', 717, 0.9, 0.1, 81, 0, ['fat']),
  'fresh-cream': I('Fresh cream (25% fat)', 242, 2.1, 3.8, 25, 0, ['dairy', 'fat']),
  'tofu-silken': I('Tofu, silken', 55, 4.8, 2.4, 2.7, 0.2, ['protein-anchor']),
  'soy-milk': I('Soy milk, unsweetened', 33, 2.9, 1.7, 1.8, 0.4, ['dairy']),
  // coconut
  'coconut-fresh': I('Coconut, fresh', 354, 3.3, 15, 33, 9, ['fat']),
  'coconut-milk': I('Coconut milk (canned)', 197, 2, 2.8, 21, 0, ['fat']),
  'coconut-desiccated': I('Coconut, desiccated', 660, 6.9, 24, 65, 16, ['fat']),
}

const R = (id, name, category, servings, ingredients, steps, tags, notes) => ({
  id,
  name,
  category,
  servings,
  yieldGramsCooked: null,
  ingredients,
  steps,
  tags,
  ...(notes ? { notes } : {}),
  source: 'seed-expansion',
  updatedAt: NOW,
})
const ing = (ref, grams, note) => (note ? { ref, grams, note } : { ref, grams })

const newRecipes = [
  R('tofu-paratha', 'Tofu paratha', 'breakfast', 1,
    [ing('atta', 60), ing('tofu-firm', 100, 'pressed dry, grated into the dough'), ing('onion', 20, 'fine'), ing('green-chili', 5), ing('oil', 5, 'for the tawa')],
    ['Press tofu 10 min, grate, knead into atta with onion, chili, salt, ajwain — the tofu replaces most of the water.', 'Roll 2 parathas; cook on a hot tawa with a light brush of oil.', 'Serve with Fage raita (adds ~15 g protein per 150 g).'],
    ['high-protein', 'breakfast', 'tofu-in-dough'],
    'Tofu disappears into the dough — same paratha taste, nearly double the protein of plain.'),
  R('paneer-paratha', 'Paneer paratha', 'breakfast', 1,
    [ing('atta', 60), ing('paneer-low-fat', 80, 'crumbled fine'), ing('onion', 20, 'fine'), ing('green-chili', 5), ing('oil', 5, 'for the tawa')],
    ['Knead a soft atta dough.', 'Stuff with spiced paneer-onion mix (salt, red chili, garam masala, coriander).', 'Roll gently, cook both sides with a light brush of oil.'],
    ['high-protein', 'breakfast'],
    'The classic. Low-fat paneer keeps it ~400 kcal; whole-milk paneer adds ~90 kcal.'),
  R('tofu-atta-rotis', 'Tofu-atta rotis (batch of 5)', 'lunch-dinner', 5,
    [ing('atta', 100), ing('tofu-firm', 100, 'pressed, blended smooth, kneaded in as the water')],
    ['Blend pressed tofu smooth; knead into atta (add water only if needed).', 'Rest 15 min; roll and cook 5 rotis as usual.', '1 serving = 1 rotli.'],
    ['daily-staple', 'tofu-in-dough', 'gujarati'],
    'Protein rotli: ~87 kcal / 4.4 g protein each vs 105 / 3.5 for plain — swap into any meal.'),
  R('methi-tofu-thepla', 'Methi-tofu thepla', 'breakfast', 1,
    [ing('atta', 60), ing('tofu-firm', 60, 'grated in'), ing('methi-leaves', 30, 'chopped'), ing('fage-0', 20, 'in the dough'), ing('ginger', 5), ing('oil', 8, 'for the tawa')],
    ['Knead everything with turmeric, chili powder, salt, a pinch of jaggery.', 'Roll thin; cook 2 theplas with a light brush of oil.', 'Travels well — good tiffin food.'],
    ['gujarati', 'tofu-in-dough', 'breakfast'],
    'Classic Gujarati thepla with tofu smuggled in — +6 g protein over plain methi thepla.'),
  R('besan-dhokla', 'Besan dhokla (steamed)', 'snack', 2,
    [ing('besan', 100), ing('rava-sooji', 20), ing('fage-0', 50, 'sours the batter'), ing('sugar', 5), ing('oil', 10, 'tempering')],
    ['Whisk besan, rava, yogurt, water, turmeric, salt, sugar to idli-batter consistency; rest 15 min.', 'Add 1 tsp Eno, pour into a greased plate, steam 15 min.', 'Temper: oil, mustard seeds, curry leaves, green chili + 2 tbsp water; pour over. Coriander on top.'],
    ['gujarati', 'snack', 'steamed'],
    'Steamed, not fried — the oil in the vaghar is the only fat lever.'),
  R('gatte-ki-sabzi', 'Gatte ki sabzi (Greek yogurt gravy)', 'lunch-dinner', 2,
    [ing('besan', 80), ing('fage-0', 200, 'whisked for the gravy'), ing('garlic', 10), ing('ginger', 5), ing('oil', 10)],
    ['Knead besan with salt, chili, ajwain, 1 tsp of the yogurt and a little water; roll into logs, boil 10 min, slice into gatte.', 'Temper oil with jeera, garlic, ginger; add whisked yogurt + boiling water off heat, stirring (keeps it from splitting).', 'Simmer gatte in the gravy 5–7 min.'],
    ['high-protein', 'rajasthani'],
    'Fage replaces dahi in the gravy — nearly triple the protein of the standard version.'),
  R('paneer-tikka', 'Paneer tikka (oven/air-fryer)', 'lunch-dinner', 2,
    [ing('paneer-low-fat', 200, 'large cubes'), ing('fage-0', 60, 'marinade base'), ing('capsicum', 100), ing('onion', 80, 'petals'), ing('oil', 5, 'brushed')],
    ['Marinate paneer + veg in yogurt, tandoori masala, kasuri methi, salt, lemon — 30 min.', 'Air-fry or bake at 200°C ~12 min, turning once; brush with oil.', 'Finish with chaat masala.'],
    ['high-protein', 'quick', 'no-gravy'],
    'A 250-kcal dinner anchor with 24 g protein. Pair with tofu-atta rotis.'),
  R('paneer-frankie', 'Paneer frankie wrap', 'lunch-dinner', 1,
    [ing('atta', 60, 'for 1 large roti'), ing('paneer-low-fat', 100, 'bhurji-style filling'), ing('cabbage', 50, 'shredded'), ing('carrot', 30, 'grated'), ing('fage-0', 30, 'mint-yogurt spread'), ing('oil', 5)],
    ['Cook a large thin roti.', 'Sauté crumbled paneer with pav bhaji masala; make a quick mint-yogurt spread.', 'Assemble: spread, paneer, veg, onion, a squeeze of lime; roll tight.'],
    ['high-protein', 'quick', 'one-hand-meal'],
    '31 g protein in one hand. The whole lunch, no sides needed.'),
  R('yogurt-protein-bowl', 'Greek yogurt protein bowl', 'breakfast', 1,
    [ing('fage-0', 250), ing('banana', 80), ing('mixed-berries', 60), ing('flax-seeds', 10, 'ground'), ing('almonds', 10, 'chopped'), ing('honey', 10)],
    ['Layer everything in a bowl. Done in 2 minutes.', 'Optional: cinnamon or cardamom on top.'],
    ['no-cook', 'quick', 'high-protein'],
    'The no-blender fallback breakfast — 26 g protein, zero cooking.'),
  R('cucumber-raita', 'Cucumber raita (Fage)', 'snack', 2,
    [ing('fage-0', 250), ing('cucumber', 150, 'grated, squeezed'), ing('coriander-leaves', 10)],
    ['Whisk yogurt smooth with roasted jeera powder, salt, black salt.', 'Fold in cucumber and coriander; chill.'],
    ['no-cook', 'side', 'light'],
    'Adds 13 g protein to any dal-rice or paratha meal for 86 kcal.'),
  R('makhana-chana-mix', 'Roasted makhana-chana mix', 'snack', 2,
    [ing('makhana', 30), ing('roasted-chana', 40), ing('peanuts', 20), ing('oil', 5)],
    ['Dry-roast makhana until crisp (5–6 min, low flame).', 'Toss everything with oil, salt, turmeric, chili powder while warm.', 'Keeps 2 weeks airtight.'],
    ['make-ahead', 'evening-snack'],
    'The chai-time replacement for farsan — 8 g protein per handful-and-a-half.'),
]

let addedI = 0
for (const [key, val] of Object.entries(newIngredients)) {
  if (db.ingredients[key]) continue
  db.ingredients[key] = val
  addedI++
}
let addedR = 0
for (const r of newRecipes) {
  if (db.recipes.some((x) => x.id === r.id)) continue
  db.recipes.push(r)
  addedR++
}

writeFileSync(path, JSON.stringify(db, null, 2) + '\n')
console.log(`ingredients +${addedI} (total ${Object.keys(db.ingredients).length}), recipes +${addedR} (total ${db.recipes.length})`)
