import './style.css';
import { cellId, conflicts, generatePuzzle, canComplete, type Puzzle } from './puzzle';

// --- configuration ---------------------------------------------------------
type Diff = 'easy' | 'medium' | 'hard';
type Mode = 'single' | 'endless';
type Status = 'playing' | 'won' | 'lost';

// Note: grids larger than 9 are intentionally avoided — unique-puzzle
// generation cost explodes beyond 9×9 (≈5s at 11×11). Difficulty above 9×9 is
// expressed through the clock (`drain`: seconds for the score to reach 0).
const DIFFS: Record<Diff, { label: string; size: number; drain: number }> = {
  easy: { label: 'Easy', size: 7, drain: 150 },
  medium: { label: 'Medium', size: 9, drain: 120 },
  hard: { label: 'Hard', size: 9, drain: 70 },
};

const START_SCORE = 1000; // each puzzle starts here and drains to 0
const HINT_COST = 80; // score penalty per hint

// --- state -----------------------------------------------------------------
let diff: Diff = 'medium';
let mode: Mode = 'single';

let puzzle: Puzzle;
let size = DIFFS[diff].size;
let placed = new Set<number>(); // cells where the player placed a leader
let history: number[] = []; // placement order, for undo
let status: Status = 'playing';
let startMs = 0;
let penalties = 0; // accumulated hint penalties (this puzzle)
let finalScore = 0; // banked score for the just-solved puzzle
let deadEnd = false; // current placement can no longer reach a solution
let revealed = false; // show the solution after a loss
let notice = ''; // transient message (e.g. failed hint)

// endless-run tallies
let totalScore = 0;
let solvedCount = 0;
let lastBank = 0;

let ticker: number | undefined;

const app = document.querySelector<HTMLDivElement>('#app')!;

// --- derived helpers -------------------------------------------------------
function drainSeconds(): number {
  return DIFFS[diff].drain;
}

function isBlocked(id: number): boolean {
  if (placed.has(id)) return false;
  const region = puzzle.regionOf[id];
  for (const l of placed) {
    if (conflicts(l, id, size)) return true; // same row/column or king-adjacent
    if (puzzle.regionOf[l] === region) return true; // region already has a leader
  }
  return false;
}

function remainingScore(): number {
  if (status === 'won') return finalScore; // single-mode freeze
  const elapsed = (performance.now() - startMs) / 1000;
  const drained = (elapsed * START_SCORE) / drainSeconds();
  return Math.max(0, Math.min(START_SCORE, Math.ceil(START_SCORE - drained - penalties)));
}

function isWin(): boolean {
  if (placed.size !== size) return false;
  const hit = new Set<number>();
  for (const l of placed) hit.add(puzzle.regionOf[l]);
  return hit.size === size; // exactly one leader per region
}

// --- run / puzzle lifecycle ------------------------------------------------
function startRun() {
  totalScore = 0;
  solvedCount = 0;
  lastBank = 0;
  loadPuzzle(true);
}

function loadPuzzle(resetClock: boolean) {
  size = DIFFS[diff].size;
  puzzle = generatePuzzle(size);
  placed = new Set();
  history = [];
  penalties = 0;
  finalScore = 0;
  deadEnd = false;
  revealed = false;
  notice = '';
  status = 'playing';
  if (resetClock) startMs = performance.now();
  startTicker();
  render();
}

function startTicker() {
  stopTicker();
  ticker = window.setInterval(() => {
    if (status !== 'playing') return;
    if (remainingScore() <= 0) {
      status = 'lost';
      stopTicker();
      render();
    } else {
      updateHud();
    }
  }, 60);
}

function stopTicker() {
  if (ticker !== undefined) clearInterval(ticker);
  ticker = undefined;
}

function handleSolve() {
  finalScore = remainingScore();
  solvedCount++;
  if (mode === 'endless') {
    totalScore += finalScore;
    lastBank = finalScore;
    loadPuzzle(true); // next puzzle, fresh clock, run continues
  } else {
    status = 'won';
    stopTicker();
    render();
  }
}

// --- moves -----------------------------------------------------------------
function onCellClick(id: number) {
  if (status !== 'playing') return;
  notice = '';
  if (placed.has(id)) removeLeader(id);
  else if (!isBlocked(id)) addLeader(id);
}

function addLeader(id: number) {
  placed.add(id);
  history.push(id);
  if (isWin()) {
    handleSolve();
    return;
  }
  deadEnd = !canComplete(puzzle, placed);
  render();
}

function removeLeader(id: number) {
  placed.delete(id);
  history = history.filter((h) => h !== id);
  deadEnd = placed.size > 0 && !canComplete(puzzle, placed);
  render();
}

function undo() {
  if (!history.length || status !== 'playing') return;
  notice = '';
  removeLeader(history[history.length - 1]);
}

function clearBoard() {
  if (status !== 'playing') return;
  placed = new Set();
  history = [];
  deadEnd = false;
  notice = '';
  render();
}

function hint() {
  if (status !== 'playing') return;
  notice = '';
  const covered = new Set([...placed].map((c) => puzzle.regionOf[c]));
  const order = shuffledRegions();
  for (const r of order) {
    if (covered.has(r)) continue;
    const cell = puzzle.solution[r];
    if (!placed.has(cell) && !isBlocked(cell)) {
      penalties += HINT_COST; // pay for the hint, then place the correct leader
      addLeader(cell);
      return;
    }
  }
  notice = 'No safe hint available — undo a misplaced leader first.';
  render();
}

function shuffledRegions(): number[] {
  const a = [...Array(size).keys()];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- rendering -------------------------------------------------------------
function render() {
  const endless = mode === 'endless';
  app.innerHTML = `
    <div class="game">
      <header class="hud">
        <h1>Leaders</h1>
        <div class="stats">
          <div class="stat"><span class="label">Score</span><span id="score" class="value">${remainingScore()}</span></div>
          ${
            endless
              ? `<div class="stat"><span class="label">Banked</span><span class="value">${totalScore}</span></div>
                 <div class="stat"><span class="label">Solved</span><span class="value">${solvedCount}</span></div>`
              : `<div class="stat"><span class="label">Leaders</span><span class="value">${placed.size}/${size}</span></div>`
          }
        </div>
      </header>

      <div class="selectors">
        <div class="segmented" id="diff">
          ${(Object.keys(DIFFS) as Diff[])
            .map((d) => `<button data-diff="${d}" class="${d === diff ? 'active' : ''}">${DIFFS[d].label}</button>`)
            .join('')}
        </div>
        <div class="segmented" id="mode">
          <button data-mode="single" class="${mode === 'single' ? 'active' : ''}">Single</button>
          <button data-mode="endless" class="${mode === 'endless' ? 'active' : ''}">Endless</button>
        </div>
      </div>

      <div class="board" id="board" style="grid-template-columns: repeat(${size}, 1fr)">${renderCells()}</div>

      <div class="status-line ${deadEnd ? 'warn' : ''}">${renderStatusLine(endless)}</div>

      <div class="controls">
        <button id="hint" ${status !== 'playing' ? 'disabled' : ''}>Hint −${HINT_COST}</button>
        <button id="undo" ${status !== 'playing' || history.length === 0 ? 'disabled' : ''}>Undo</button>
        <button id="clear" ${status !== 'playing' || placed.size === 0 ? 'disabled' : ''}>Clear</button>
        ${status === 'lost' ? `<button id="reveal">${revealed ? 'Hide' : 'Reveal'}</button>` : ''}
        <button id="new" class="primary">New game</button>
      </div>

      <p class="rules">One leader per coloured region — which works out to one per
      row and one per column. No two leaders may touch, not even diagonally.
      Placing a leader (♛) locks every cell it controls, including the rest of its
      region (✕). Solve before the score reaches 0.</p>

      ${renderBanner(endless)}
    </div>
  `;

  wire();
}

function renderStatusLine(endless: boolean): string {
  if (notice) return notice;
  if (deadEnd) return '⚠ No solution from here — undo a leader to get back on track.';
  if (endless && lastBank > 0 && status === 'playing') return `Nice — banked +${lastBank}. Next puzzle!`;
  return 'Place a leader in every region.';
}

function renderCells(): string {
  let html = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const id = cellId(r, c, size);
      const g = puzzle.regionOf[id];
      const classes = ['cell', `region-${g}`];

      if (r === 0 || puzzle.regionOf[cellId(r - 1, c, size)] !== g) classes.push('bt');
      if (r === size - 1 || puzzle.regionOf[cellId(r + 1, c, size)] !== g) classes.push('bb');
      if (c === 0 || puzzle.regionOf[cellId(r, c - 1, size)] !== g) classes.push('bl');
      if (c === size - 1 || puzzle.regionOf[cellId(r, c + 1, size)] !== g) classes.push('br');

      let mark = '';
      const isSolutionCell = revealed && puzzle.solution[g] === id;
      if (placed.has(id)) {
        classes.push('leader');
        mark = '♛';
      } else if (isSolutionCell) {
        classes.push('solution');
        mark = '♛';
      } else if (status === 'playing' && isBlocked(id)) {
        classes.push('blocked');
        mark = '✕';
      }

      html += `<div class="${classes.join(' ')}" data-id="${id}">${mark}</div>`;
    }
  }
  return html;
}

function renderBanner(endless: boolean): string {
  if (status === 'won') {
    return `<div class="banner win">Solved! Final score <strong>${finalScore}</strong>.</div>`;
  }
  if (status === 'lost') {
    return endless
      ? `<div class="banner lose">Run over — you solved <strong>${solvedCount}</strong> puzzle${solvedCount === 1 ? '' : 's'} for <strong>${totalScore}</strong> points.</div>`
      : `<div class="banner lose">Out of time — the score hit 0.</div>`;
  }
  return '';
}

function updateHud() {
  const el = document.querySelector<HTMLSpanElement>('#score');
  if (el) el.textContent = String(remainingScore());
}

function wire() {
  document.querySelector('#board')!.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.cell');
    if (target) onCellClick(Number(target.dataset.id));
  });
  document.querySelectorAll<HTMLButtonElement>('#diff button').forEach((b) =>
    b.addEventListener('click', () => {
      const d = b.dataset.diff as Diff;
      if (d !== diff) {
        diff = d;
        startRun();
      }
    }),
  );
  document.querySelectorAll<HTMLButtonElement>('#mode button').forEach((b) =>
    b.addEventListener('click', () => {
      const m = b.dataset.mode as Mode;
      if (m !== mode) {
        mode = m;
        startRun();
      }
    }),
  );
  document.querySelector('#hint')?.addEventListener('click', hint);
  document.querySelector('#undo')?.addEventListener('click', undo);
  document.querySelector('#clear')?.addEventListener('click', clearBoard);
  document.querySelector('#reveal')?.addEventListener('click', () => {
    revealed = !revealed;
    render();
  });
  document.querySelector('#new')!.addEventListener('click', startRun);
}

function dismissSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  // brief minimum so the splash doesn't merely flash on a fast load
  window.setTimeout(() => {
    el.classList.add('hide');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    window.setTimeout(() => el.remove(), 700); // fallback if transitionend doesn't fire
  }, 500);
}

// boot
startRun();
dismissSplash();
