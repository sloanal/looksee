#!/usr/bin/env node

/**
 * Renders scripts/og-image.html to app/opengraph-image.png and
 * app/twitter-image.png (1200×630), which Next serves as the link preview.
 *
 * Usage: node scripts/generate-og-image.js
 *
 * Needs Playwright with Chromium (`npx playwright install chromium` if it
 * isn't already available) and network access for Google Fonts.
 */

const fs = require('fs')
const path = require('path')

let chromium
try {
  ;({ chromium } = require('playwright'))
} catch (e) {
  console.error('Error: playwright is required. Install it with: npm install --no-save playwright')
  process.exit(1)
}

const root = path.join(__dirname, '..')
const source = path.join(__dirname, 'og-image.html')
const outputs = ['opengraph-image.png', 'twitter-image.png'].map((f) => path.join(root, 'app', f))

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto(`file://${source}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)

  const missing = await page.evaluate(() =>
    ['Archivo', 'Instrument Serif'].filter(
      (family) => ![...document.fonts].some((f) => f.family === family && f.status === 'loaded'),
    )
  )
  if (missing.length) {
    console.error(`Error: fonts did not load: ${missing.join(', ')}`)
    await browser.close()
    process.exit(1)
  }

  const png = await page.screenshot({ type: 'png' })
  await browser.close()
  for (const out of outputs) {
    fs.writeFileSync(out, png)
    console.log(`Wrote ${path.relative(root, out)} (${Math.round(png.length / 1024)} KB)`)
  }
})()
