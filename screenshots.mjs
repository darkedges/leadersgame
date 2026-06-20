// Responsive smoke check: renders the running dev server at several viewport
// sizes, saves screenshots to ./screenshots/, and reports tap-target size and
// any horizontal overflow. Requires `npm run dev` to be running first.
//
//   npm run shots
//
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const URL = process.env.URL ?? 'http://localhost:5173/';
const cases = [
  { name: '360x640', w: 360, h: 640 },
  { name: '390x844', w: 390, h: 844 }, // iPhone 12/13/14
  { name: '768x1024', w: 768, h: 1024 }, // iPad portrait
  { name: '1280x800', w: 1280, h: 800 }, // desktop
];

await mkdir('screenshots', { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const c of cases) {
  const page = await browser.newPage({
    viewport: { width: c.w, height: c.h },
    deviceScaleFactor: 2,
  });
  await page.goto(URL, { waitUntil: 'networkidle' });

  const m = await page.evaluate(() => {
    const doc = document.documentElement;
    const r = document.querySelector('.cell')?.getBoundingClientRect();
    return {
      hScroll: doc.scrollWidth > doc.clientWidth,
      cellPx: r ? Math.round(Math.min(r.width, r.height)) : null,
    };
  });

  await page.screenshot({ path: `screenshots/${c.name}.png`, fullPage: true });
  if (m.hScroll) problems++;
  console.log(
    `${c.name.padEnd(10)} cell=${String(m.cellPx).padStart(3)}px  ` +
      `horizontalScroll=${m.hScroll ? 'YES ⚠' : 'no'}`,
  );
  await page.close();
}

await browser.close();
console.log(problems ? `\n${problems} viewport(s) overflow horizontally.` : '\nAll viewports OK.');
process.exit(problems ? 1 : 0);
