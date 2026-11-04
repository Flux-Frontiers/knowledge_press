// Writes dist/catalog.json: the slug -> (genre, book) table the app's forest
// server reads to answer books/<slug>.json from its own corpus packs.
//
//   node scripts/export-catalog.mjs              write dist/catalog.json
//   node scripts/export-catalog.mjs out.json     write somewhere else
//
// Run after `npm run build` (the Makefile's *-stage-forest targets do), so the
// table ships beside the build it came from and the app can never disagree
// with the forest it carries about which slug is which book.
//
// The catalog is TypeScript split over several files that import each other
// without extensions, which node cannot load as-is; they are transpiled into
// a throwaway directory the way scripts/test.mjs does it.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The fields the app needs from each catalog entry, in catalog order. */
export function catalogEntries(books) {
  return books.map(({ slug, genre, book }) => ({ slug, genre, book }));
}

/** The forest's BOOKS, loaded from src/game/catalog*.ts. */
export async function loadBooks() {
  const { default: ts } = await import("typescript");
  const output = mkdtempSync(join(WEB, "node_modules", ".export-catalog-"));
  try {
    writeFileSync(join(output, "package.json"), '{"type":"commonjs"}');
    const game = join(WEB, "src", "game");
    for (const file of readdirSync(game).filter((f) => /^catalog.*\.ts$/.test(f))) {
      const { outputText } = ts.transpileModule(readFileSync(join(game, file), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
      });
      writeFileSync(join(output, file.replace(/\.ts$/, ".js")), outputText);
    }
    return createRequire(join(output, "index.js"))("./catalog.js").BOOKS;
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const target = resolve(process.argv[2] ?? join(WEB, "dist", "catalog.json"));
  const entries = catalogEntries(await loadBooks());
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(entries) + "\n");
  console.log(`Wrote ${entries.length} catalog entries to ${target}`);
}
