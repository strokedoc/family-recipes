# Setting up Rasoi on your phones

One-time setup, about 20 minutes. No coding involved. You'll do steps 1–3 once on a
computer, then step 4 on each phone.

## 1. Put the app on GitHub

1. Create a GitHub account for each of you (if you don't have one): https://github.com/join
2. On **one** account (this becomes the "owner"), create a new repository:
   - Go to https://github.com/new
   - Name: `family-recipes`
   - Visibility: **Public** (required for free GitHub Pages — the data contains only
     recipes and first-initial calorie targets, no health data)
   - Do NOT tick "Add a README". Click **Create repository**.
3. Upload this project folder to that repository. Easiest way from this Mac's Terminal:
   ```
   cd "/Users/harsh/Fitness coach/family-recipes"
   git remote add origin https://github.com/YOUR-USERNAME/family-recipes.git
   git push -u origin main
   ```
   (It will ask you to sign in to GitHub the first time.)
4. Invite the second person as a collaborator: repo page → **Settings → Collaborators →
   Add people** → their GitHub username. They accept the email invite.

## 2. Turn on GitHub Pages

1. On the repo page: **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Wait 2–3 minutes (the Actions tab shows a green tick when done).
4. Your app is now live at: `https://YOUR-USERNAME.github.io/family-recipes/`
   Open it in a browser to check — you should see the recipes.

## 3. Create a token for each phone (this is what lets you save edits)

Each of you does this on your **own** GitHub account, so the app's edits are labeled
with who made them:

1. Go to https://github.com/settings/personal-access-tokens/new
2. Token name: `rasoi-phone`. Expiration: **1 year** (put a calendar reminder to renew).
3. Under **Repository access** choose **Only select repositories** → pick `family-recipes`.
   (For the collaborator: the repo appears once you've accepted the invite.)
4. Under **Permissions → Repository permissions**, find **Contents** and set it to
   **Read and write**. Leave everything else alone.
5. Click **Generate token** and **copy it** (starts with `github_pat_`). You'll paste it
   into the phone in the next step — if you lose it, just make a new one.

## 4. Install on each iPhone

1. Open `https://YOUR-USERNAME.github.io/family-recipes/` in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → Add. A "Rasoi" icon appears.
3. Open the app from the home screen, tap **⚙︎ Settings**:
   - Repository: `YOUR-USERNAME/family-recipes` (the owner's username, on both phones)
   - Token: paste your own token from step 3
   - Tap **Save & test** — you should see "✓ Sync OK".

Done. Both phones now read and write the same recipe database.

## Everyday things worth knowing

- **No signal in the kitchen?** Reading always works offline. Edits made offline queue
  up (the header shows "1 pending") and sync automatically when you're back online.
- **You both edited at the same time?** Fine, as long as it was different recipes. If
  you both edited the *same* recipe, the later save wins and the app tells you.
- **Numbers look off vs Cronometer?** Fix the ingredient in **⚖︎ Library** (per-100g
  values) — every recipe using it updates instantly. That's by design; calibrate freely.
- **Weigh the pot.** After cooking, weigh the full pot and tap "I weighed it" on the
  recipe. That unlocks "180 g = 210 kcal" portion math and the Copy-for-Cronometer
  button for exact portions.
- **Token expired?** The app will show a sync error. Make a new token (step 3) and paste
  it into Settings. Nothing is lost — queued edits send once the new token works.
