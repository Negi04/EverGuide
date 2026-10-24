// Performance budget: total JavaScript a visitor downloads before the first page renders
// (the entry script plus everything index.html preloads). Vite's per-chunk warning can't
// catch growth once code is split across several chunks, so we check the total.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const BUDGET_GZIP_KB = 185 // measured 175 kB on 2026-10-24; raise only after investigating

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const files = [...new Set([...html.matchAll(/\/assets\/[^"]+\.js/g)].map((m) => m[0]))]
const gzipKb =
  files.reduce((sum, file) => sum + gzipSync(readFileSync(new URL(`../dist${file}`, import.meta.url)), { level: 9 }).length, 0) /
  1024

const summary = `first-load JavaScript: ${gzipKb.toFixed(1)} kB gzip (budget ${BUDGET_GZIP_KB} kB, ${files.length} files)`
if (gzipKb > BUDGET_GZIP_KB) {
  console.error(`✗ ${summary}`)
  process.exit(1)
}
console.log(`✓ ${summary}`)
