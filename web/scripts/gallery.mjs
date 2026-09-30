// The book gallery's tree portraits (docs/forest/gallery.md), rendered from
// the forest itself with its `?shot=` mode (src/game/portrait.ts): each tree
// alone at midday in summer, every leaf drawn, all from one distance so their
// sizes compare.
//
//   npm run dev                              # in another terminal
//   npm i --no-save puppeteer-core           # drives the Chrome you have
//   node scripts/gallery.mjs                 # or: make docs-gallery
//
// Env: FOREST_URL (default http://localhost:5173), CHROME (default the macOS
// Google Chrome), OUT (default ../docs/assets/trees). Each tree gets its own
// browser: the larger forests have crashed a long-lived headless tab.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";

/** The gallery's books, in the page's order; keep in step with docs/forest/gallery.md. */
export const GALLERY = [
  "the_diary_of_samuel_pepys_complete",
  "war_and_peace",
  "moby_dick",
  "adventures_of_huckleberry_finn",
  "hamlet",
  "on_the_origin_of_species_charles_darwin",
  "frankenstein",
  "the_divine_comedy_carys_translation",
  "the_divine_comedy_longfellows_translation",
  "don_quixote",
  "a_modest_proposal",
  "the_republic",
  "the_bible",
  "one_thousand_and_one_nights_lane_translation",
  "narrative_of_the_life_of_frederick_douglass",
  "a_vindication_of_the_rights_of_woman_wollstonecraft",
];

const base = process.env.FOREST_URL ?? "http://localhost:5173";
const chrome = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const out = resolve(process.env.OUT ?? "../docs/assets/trees");
const only = process.argv.slice(2);
mkdirSync(out, { recursive: true });

for (const slug of only.length ? only : GALLERY) {
  const started = Date.now();
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: "new",
    // Software WebGL, so this runs without a GPU.
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"],
    defaultViewport: { width: 1200, height: 750, deviceScaleFactor: 1 },
  });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error(`${slug}: ${e.message}`));
    await page.goto(`${base}/?shot=${slug}`, { waitUntil: "domcontentloaded" });
    // Installed once the forest has regrown with every leaf; the frame fits the largest tree.
    await page.waitForFunction("typeof window.__shotFrame === 'function'", { timeout: 600000, polling: 500 });
    const ok = await page.evaluate((s, all) => window.__shot(s, window.__shotFrame(all)), slug, GALLERY);
    if (!ok) throw new Error(`no tree for ${slug}`);
    await page.waitForFunction("window.__shotReady === true", { timeout: 600000, polling: 500 });
    await page.screenshot({ path: `${out}/${slug}.jpg`, type: "jpeg", quality: 82 });
    console.log(`${slug}  ${((Date.now() - started) / 1000).toFixed(0)} s`);
  } finally {
    await browser.close();
  }
}
