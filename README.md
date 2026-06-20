# Leaders — a timed logic puzzle

A 9×9 grid is split into 9 coloured regions. Place exactly **one leader per
region** so that no two leaders share a row or column, and no two ever touch —
not even diagonally. Because there are 9 regions on a 9×9 board, a valid
solution always ends up with exactly one leader per row and per column too.

Every generated puzzle has **exactly one** solution.

## How to play

- **Click an empty cell** to place a leader (♛). Doing so instantly locks every
  cell it controls — its whole row, its whole column, the 8 cells touching it,
  and the rest of its region — marking them with ✕ and disabling them.
- **Click a leader** to remove it and free the cells it had locked.
- You win when every region holds a leader. Solve before the **score** counts
  down from 1000 to 0; your remaining score when you solve is banked. Hit 0 and
  it's game over (you can then reveal the solution).

## Features

- **Difficulty** — *Easy* (7×7, gentle clock), *Medium* (9×9), *Hard* (9×9, fast
  clock). Larger boards aren't offered because unique-puzzle generation cost
  explodes past 9×9, so harder play is expressed through time pressure.
- **Hint** — fills in one correct leader for an `−80` score penalty. If misplaced
  leaders have boxed you in, it tells you to undo instead.
- **Undo** — steps back through your placements one at a time.
- **Dead-end flag** — because each puzzle has a single solution, any wrong leader
  makes the board unsolvable; a ⚠ warning appears so you know to undo (without
  giving away which move was wrong).
- **Endless mode** — solve puzzles back-to-back; each solve banks its remaining
  score and starts a fresh puzzle/clock. The run ends when a clock hits 0, and
  your total + puzzles-solved count is your score.

## Run it

```bash
npm install
npm run dev      # then open the printed http://localhost:5173/ URL
```

Other scripts:

```bash
npm run build    # type-check + production bundle into dist/
npm run preview  # serve the production build
npm run shots    # responsive screenshot check (needs `npm run dev` running)
```

## Installable app (PWA)

The game is a Progressive Web App, so it can be installed to a phone/desktop home
screen and run standalone (no browser chrome), with offline support:

- **Manifest + service worker** via `vite-plugin-pwa` (`registerType: autoUpdate`,
  so a new deploy refreshes the installed app). Config lives in `vite.config.ts`.
- **Branded splash** — an inline overlay in `index.html` (painted before any JS/CSS
  loads) that fades out once the game mounts; Android also gets a native splash
  generated from the manifest icon + colours.
- **Icons** are committed in `public/` (`pwa-192/512`, `pwa-maskable-512`,
  `apple-touch-icon`, `favicon.svg`). Regenerate them from the vector source with:

  ```bash
  npm run icons   # rasterises tools/gen-icons.mjs via Playwright's Chromium
  ```

  Cloudflare only runs `npm run build`, so the icons must stay committed.

## Responsiveness

The layout is mobile-first: the panel is `min(100%, 560px)`, the board fills the
available width with square cells, and chrome (padding/fonts) shrinks on small
screens. Touch is handled with `touch-action: manipulation` (no double-tap zoom)
and hover effects are gated behind `@media (hover: hover)` so nothing sticks lit
after a tap. Tall content scrolls instead of being clipped.

`npm run shots` renders the running dev server at 360 / 390 / 768 / 1280px
widths, saves images to `screenshots/`, and fails if any viewport scrolls
horizontally. Verified tap-target sizes: 35px @360px, 38px @390px, 56px @768px.

## Project layout

- `src/puzzle.ts` — puzzle generation. Places a valid solution, grows connected
  regions around the leaders, then repairs region borders until the solution is
  unique (each repair moves one boundary cell to kill an alternate solution).
- `src/main.ts` — game state, the click/lock rules, the countdown timer/scoring,
  and DOM rendering.
- `src/style.css` — board and UI styling (one colour per region).

## Tunables (`src/main.ts`)

- `START_SCORE` — score each puzzle starts at (1000).
- `HINT_COST` — score penalty per hint (80).
- `DIFFS` — per-difficulty board `size` and `drain` (seconds for the score to
  fall from `START_SCORE` to 0).
