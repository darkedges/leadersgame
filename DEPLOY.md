# Deploying to Cloudflare Pages (Git integration)

Every push to `main` will auto-build and deploy; pull requests get preview URLs.

## 1. Push this repo to GitHub

Create an **empty** repo at <https://github.com/new> (no README/.gitignore —
this project already has them), then:

```bash
git remote add origin https://github.com/<your-username>/leaders-puzzle.git
git push -u origin main
```

(Or, with the GitHub CLI: `gh repo create leaders-puzzle --public --source=. --push`.)

## 2. Connect it in Cloudflare

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorize Cloudflare's GitHub app (first time only) and pick the repo.
3. **Build settings:**
   - Framework preset: **Vite**
   - Build command: **`npm run build`**
   - Build output directory: **`dist`**
   - Root directory: *(leave as `/`)*
4. **Environment variables** (recommended — keeps builds fast):
   - `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` = `1`
     Playwright is a dev-only dependency for `npm run shots`; this stops
     Cloudflare from downloading a browser it never uses during the build.
5. **Save and Deploy.** First build takes ~1–2 minutes; the site lands at
   `https://<project-name>.pages.dev`.

## Notes

- **Node version** is pinned to 20 via `.node-version` so CI matches local.
- **`public/_headers`** adds security headers and long-cache for hashed assets;
  Cloudflare applies it automatically.
- No `_redirects` file is needed — this is a single static page, not an SPA with
  client-side routing.
