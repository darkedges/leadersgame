// Puzzle generation and validation for the "Leaders" game.
//
// Board: an N×N grid partitioned into N connected regions (one segment per row).
// Goal: place one "leader" per region such that no two leaders share a row or
// column, and no two are king-adjacent (touching, including diagonally). Because
// there are N regions on an N×N board, this forces exactly one leader per row
// and per column too. A generated puzzle has exactly ONE valid placement.

export interface Puzzle {
  /** board side length N (also the region count) */
  size: number;
  /** length size*size, region id (0..size-1) for each cell */
  regionOf: number[];
  /** solution[regionId] = cell id of that region's leader */
  solution: number[];
}

export const cellId = (r: number, c: number, size: number) => r * size + c;
export const rowOf = (id: number, size: number) => Math.floor(id / size);
export const colOf = (id: number, size: number) => id % size;

/** Two leaders conflict if they share a row/column or are king-adjacent. */
export function conflicts(a: number, b: number, size: number): boolean {
  const dr = Math.abs(rowOf(a, size) - rowOf(b, size));
  const dc = Math.abs(colOf(a, size) - colOf(b, size));
  if (dr === 0 || dc === 0) return true; // same row or column
  return dr <= 1 && dc <= 1; // king-adjacent (diagonal touch)
}

// --- tiny seedable PRNG (mulberry32) ---------------------------------------
type Rng = () => number;
function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function neighbors4(id: number, size: number): number[] {
  const r = rowOf(id, size);
  const c = colOf(id, size);
  const out: number[] = [];
  if (r > 0) out.push(cellId(r - 1, c, size));
  if (r < size - 1) out.push(cellId(r + 1, c, size));
  if (c > 0) out.push(cellId(r, c - 1, size));
  if (c < size - 1) out.push(cellId(r, c + 1, size));
  return out;
}

/** Randomly place `size` mutually non-conflicting leaders (the solution). */
function buildLeaders(size: number, rng: Rng): number[] {
  const leaders: number[] = [];
  const usedR = new Set<number>();
  const usedC = new Set<number>();

  const rec = (): boolean => {
    if (leaders.length === size) return true;
    const cands: number[] = [];
    for (let r = 0; r < size; r++) {
      if (usedR.has(r)) continue;
      for (let c = 0; c < size; c++) {
        if (usedC.has(c)) continue;
        const id = cellId(r, c, size);
        if (leaders.some((l) => conflicts(l, id, size))) continue;
        cands.push(id);
      }
    }
    shuffle(cands, rng);
    for (const id of cands) {
      leaders.push(id);
      usedR.add(rowOf(id, size));
      usedC.add(colOf(id, size));
      if (rec()) return true;
      leaders.pop();
      usedR.delete(rowOf(id, size));
      usedC.delete(colOf(id, size));
    }
    return false;
  };

  while (!rec()) {
    /* retry — a valid placement effectively always exists */
  }
  return leaders;
}

/**
 * Grow connected regions from the seed leaders until every cell is assigned.
 * A random frontier cell is absorbed each step, giving organic region shapes.
 */
function growRegions(size: number, seeds: number[], rng: Rng): number[] {
  const regionOf = new Array<number>(size * size).fill(-1);
  seeds.forEach((s, i) => (regionOf[s] = i));

  const frontier: number[] = [];
  const inFrontier = new Set<number>();
  const pushFrontier = (id: number) => {
    if (regionOf[id] === -1 && !inFrontier.has(id)) {
      frontier.push(id);
      inFrontier.add(id);
    }
  };
  for (const s of seeds) neighbors4(s, size).forEach(pushFrontier);

  while (frontier.length > 0) {
    const idx = Math.floor(rng() * frontier.length);
    const cell = frontier[idx];
    frontier.splice(idx, 1);
    inFrontier.delete(cell);
    if (regionOf[cell] !== -1) continue;

    const assignedNbrs = neighbors4(cell, size).filter((n) => regionOf[n] !== -1);
    const pick = assignedNbrs[Math.floor(rng() * assignedNbrs.length)];
    regionOf[cell] = regionOf[pick];
    neighbors4(cell, size).forEach(pushFrontier);
  }
  return regionOf;
}

function groupByRegion(size: number, regionOf: number[]): number[][] {
  const groups: number[][] = Array.from({ length: size }, () => []);
  regionOf.forEach((g, id) => groups[g].push(id));
  return groups;
}

/**
 * Find a valid placement (one leader per region) that DIFFERS from `seeds`,
 * or null if `seeds` is the only solution. Regions are tried most-constrained
 * first for speed. Returns the alternate as solution[regionId] = cell.
 */
function findAlternate(
  size: number,
  regionCells: number[][],
  seeds: number[],
): number[] | null {
  const order = regionCells
    .map((_, i) => i)
    .sort((a, b) => regionCells[a].length - regionCells[b].length);

  const assign = new Array<number>(size).fill(-1);
  const chosen: number[] = [];
  let found: number[] | null = null;

  const rec = (i: number): boolean => {
    if (i === order.length) {
      for (let r = 0; r < size; r++) {
        if (assign[r] !== seeds[r]) {
          found = assign.slice();
          return true;
        }
      }
      return false; // identical to seeds — keep searching for a real alternate
    }
    const reg = order[i];
    for (const cell of regionCells[reg]) {
      if (chosen.some((ch) => conflicts(ch, cell, size))) continue;
      chosen.push(cell);
      assign[reg] = cell;
      if (rec(i + 1)) return true;
      chosen.pop();
      assign[reg] = -1;
    }
    return false;
  };

  rec(0);
  return found;
}

/** Can cell `x` be removed from region `r` while keeping it connected? */
function regionStaysConnected(
  size: number,
  regionOf: number[],
  r: number,
  x: number,
  seed: number,
): boolean {
  let total = 0;
  for (let id = 0; id < regionOf.length; id++) {
    if (regionOf[id] === r && id !== x) total++;
  }
  if (total === 0) return false; // would empty the region
  const seen = new Set<number>([seed]);
  const stack = [seed];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of neighbors4(cur, size)) {
      if (n !== x && regionOf[n] === r && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen.size === total;
}

/**
 * Destroy one alternate solution by moving a boundary cell of a mismatched
 * region into a neighbouring region. Returns false if no safe move exists.
 */
function breakAlternate(
  size: number,
  regionOf: number[],
  seeds: number[],
  alt: number[],
  rng: Rng,
): boolean {
  const diffRegions = shuffle(
    [...Array(size).keys()].filter((r) => alt[r] !== seeds[r]),
    rng,
  );
  for (const r of diffRegions) {
    const x = alt[r]; // a cell of region r that acts as a leader in the alternate
    const neighbourRegions = shuffle(
      [...new Set(neighbors4(x, size).map((n) => regionOf[n]).filter((q) => q !== r))],
      rng,
    );
    for (const q of neighbourRegions) {
      if (regionStaysConnected(size, regionOf, r, x, seeds[r])) {
        regionOf[x] = q; // reassign x; the alternate using x as r's leader dies
        return true;
      }
    }
  }
  return false;
}

/** Generate an N×N puzzle that has exactly one solution (the seed placement). */
export function generatePuzzle(size = 9, seed = (Math.random() * 2 ** 32) >>> 0): Puzzle {
  const rng = makeRng(seed);
  for (let attempt = 0; attempt < 400; attempt++) {
    const seeds = buildLeaders(size, rng);
    const regionOf = growRegions(size, seeds, rng);

    let repaired = true;
    for (let rep = 0; rep < 6000; rep++) {
      const alt = findAlternate(size, groupByRegion(size, regionOf), seeds);
      if (!alt) break; // unique — done
      if (!breakAlternate(size, regionOf, seeds, alt, rng)) {
        repaired = false; // stuck; regrow from scratch
        break;
      }
    }
    if (repaired && findAlternate(size, groupByRegion(size, regionOf), seeds) === null) {
      return { size, regionOf, solution: seeds.slice() };
    }
  }
  // Extremely unlikely fallback.
  const seeds = buildLeaders(size, rng);
  return { size, regionOf: growRegions(size, seeds, rng), solution: seeds.slice() };
}

/**
 * Can the current set of placed leaders still be extended to a full valid
 * solution (one leader per region, none conflicting)? Used to flag dead ends.
 */
export function canComplete(puzzle: Puzzle, placed: Iterable<number>): boolean {
  const { size, regionOf } = puzzle;
  const placedArr = [...placed];
  const covered = new Set(placedArr.map((c) => regionOf[c]));

  const groups: number[][] = Array.from({ length: size }, () => []);
  regionOf.forEach((g, id) => {
    if (!covered.has(g)) groups[g].push(id);
  });
  const uncovered = groups
    .map((_, i) => i)
    .filter((i) => !covered.has(i))
    .sort((a, b) => groups[a].length - groups[b].length);

  const chosen = placedArr.slice();
  const rec = (i: number): boolean => {
    if (i === uncovered.length) return true;
    for (const cell of groups[uncovered[i]]) {
      if (chosen.some((ch) => conflicts(ch, cell, size))) continue;
      chosen.push(cell);
      if (rec(i + 1)) {
        chosen.pop();
        return true;
      }
      chosen.pop();
    }
    return false;
  };
  return rec(0);
}
