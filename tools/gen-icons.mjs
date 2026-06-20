// Generates the app icons (and favicon) from a single vector design, rasterised
// with the Chromium that Playwright already provides. Run: node tools/gen-icons.mjs
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

function icon({ crownScale = 1, round = 0 } = {}) {
  const grid = [33.333, 66.666]
    .map(
      (p) =>
        `<line x1="${p}" y1="6" x2="${p}" y2="94"/><line x1="6" y1="${p}" x2="94" y2="${p}"/>`,
    )
    .join('');
  const bg = round
    ? `<rect x="3" y="3" width="94" height="94" rx="${round}" fill="url(#g)"/>`
    : `<rect width="100" height="100" fill="url(#g)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#252d57"/><stop offset="1" stop-color="#0f1226"/>
    </linearGradient></defs>
    ${bg}
    <g stroke="#9fb0ff" stroke-opacity="0.10" stroke-width="1.2">${grid}</g>
    <g transform="translate(50 51) scale(${crownScale}) translate(-50 -51)">
      <path d="M50 28 L61 46 L79 35 L73.5 71 L26.5 71 L21 35 L39 46 Z"
        fill="#ffd166" stroke="#b9892a" stroke-width="1.6" stroke-linejoin="round"/>
      <rect x="26.5" y="71" width="47" height="9.5" rx="3" fill="#ffd166" stroke="#b9892a" stroke-width="1.6"/>
      <circle cx="50" cy="28" r="4.6" fill="#ffe7a6"/>
      <circle cx="21" cy="35" r="4" fill="#ffe7a6"/>
      <circle cx="79" cy="35" r="4" fill="#ffe7a6"/>
    </g>
  </svg>`;
}

const targets = [
  { file: 'public/pwa-192.png', size: 192, opts: {} },
  { file: 'public/pwa-512.png', size: 512, opts: {} },
  { file: 'public/pwa-maskable-512.png', size: 512, opts: { crownScale: 0.72 } },
  { file: 'public/apple-touch-icon.png', size: 180, opts: { crownScale: 0.9 } },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({
    viewport: { width: t.size, height: t.size },
    deviceScaleFactor: 1,
  });
  const svg = icon(t.opts).replace('<svg ', `<svg width="${t.size}" height="${t.size}" `);
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await page.waitForTimeout(40);
  await page.screenshot({ path: t.file });
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();

await writeFile('public/favicon.svg', icon({ round: 22 }), 'utf8');
console.log('wrote public/favicon.svg');
