// GitHub Contents API read/write for the repo-as-database.
// The data file lives at public/data/recipes.json so Vite ships it with the
// site (served as data/recipes.json) and the app commits to the same file.

export const DATA_PATH = 'public/data/recipes.json'

function headers(token) {
  const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

function contentsUrl(repo) {
  return `https://api.github.com/repos/${repo}/contents/${DATA_PATH}`
}

// UTF-8 safe base64
function b64encode(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// Fetch the latest data + sha straight from the API (beats the Pages CDN cache).
export async function fetchLatest({ repo, token }) {
  const res = await fetch(`${contentsUrl(repo)}?t=${Date.now()}`, {
    headers: headers(token),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`)
  const body = await res.json()
  return { data: JSON.parse(b64decode(body.content)), sha: body.sha }
}

// Commit new content. Caller supplies the sha it based the edit on.
export async function putData({ repo, token }, data, sha, message) {
  const res = await fetch(contentsUrl(repo), {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({
      message,
      content: b64encode(JSON.stringify(data, null, 2) + '\n'),
      sha,
    }),
  })
  if (res.status === 409 || res.status === 422) {
    const err = new Error('conflict')
    err.conflict = true
    throw err
  }
  if (!res.ok) throw new Error(`GitHub write failed (${res.status})`)
  const body = await res.json()
  return { sha: body.content.sha }
}

// Settings test: can we read, and (if token) do we have push permission?
export async function testConnection({ repo, token }) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: headers(token) })
  if (!res.ok) throw new Error(res.status === 404 ? 'Repo not found (check name / token scope)' : `GitHub error ${res.status}`)
  const info = await res.json()
  await fetchLatest({ repo, token }) // confirms the data file exists
  return { canWrite: Boolean(token && info.permissions?.push) }
}
