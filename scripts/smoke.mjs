import { chromium } from 'playwright'
import fs from 'node:fs'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

async function shot(name) {
  await page.screenshot({ path: `/tmp/smoke-${name}.png`, fullPage: true })
}

await page.goto('http://localhost:5173')
await page.waitForSelector('text=Welcome to Finance Tracker')
await page.click('button:has-text("Explore with Demo Data")')
await page.waitForSelector('text=Net Worth', { timeout: 15000 })
await page.waitForTimeout(300)

// --- Duplicate + delete a transaction ---
await page.goto('http://localhost:5173/transactions')
await page.waitForSelector('table')
const countText = await page.locator('text=/\\d+ transactions?/').first().textContent()
const before = parseInt(countText, 10)

await page.locator('tbody tr').first().click()
await page.waitForSelector('text=Transaction ID')
await page.click('button:has-text("Duplicate")')
await page.waitForSelector('text=Transaction duplicated', { timeout: 10000 })
await page.goto('http://localhost:5173/transactions')
await page.waitForSelector('table')
const afterDupText = await page.locator('text=/\\d+ transactions?/').first().textContent()
const afterDup = parseInt(afterDupText, 10)
console.log(`duplicate: ${before} -> ${afterDup} (expect +1)`)

await page.locator('tbody tr').first().click()
await page.waitForSelector('text=Transaction ID')
await page.click('button:has-text("Delete")')
await page.click('button:has-text("Delete"):visible >> nth=-1')
await page.waitForSelector('text=Transaction deleted', { timeout: 10000 })
await page.goto('http://localhost:5173/transactions')
await page.waitForSelector('table')
const afterDelText = await page.locator('text=/\\d+ transactions?/').first().textContent()
const afterDel = parseInt(afterDelText, 10)
console.log(`delete: ${afterDup} -> ${afterDel} (expect -1)`)

// --- CSV import dialog, full UI flow ---
const csvPath = '/tmp/import-test.csv'
fs.writeFileSync(
  csvPath,
  'Date,Description,Amount,Category\n2026-08-01,Test Grocery Run,-55.20,Groceries\n2026-08-02,Freelance Payment,600,Freelance\n',
)
await page.goto('http://localhost:5173/settings')
await page.click('button:has-text("Import CSV")')
await page.waitForSelector('text=Import Transactions from CSV')
const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("Choose File")')])
await fileChooser.setFiles(csvPath)
await page.waitForSelector('text=Map Columns')
await shot('1-csv-import-mapped')
await page.waitForSelector('text=2 valid')
await page.click('button:has-text("Import 2 Transactions")')
await page.waitForSelector('text=Imported 2 transactions', { timeout: 10000 })
console.log('CSV import dialog: OK')

// --- JSON export + restore round-trip ---
const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export JSON Backup")')])
const backupPath = '/tmp/roundtrip-backup.json'
await jsonDownload.saveAs(backupPath)

// Clear all data, then restore from the backup we just took.
await page.click('button:has-text("Clear All Data")')
await page.click('button:has-text("Clear Everything")')
await page.waitForSelector('text=All data cleared', { timeout: 10000 })
await page.goto('http://localhost:5173/accounts')
await page.waitForSelector('text=No accounts yet')
console.log('clear all data: OK (accounts empty)')

await page.goto('http://localhost:5173/settings')
const [fileChooser2] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("Restore JSON Backup")')])
await fileChooser2.setFiles(backupPath)
await page.waitForSelector('text=Restore from backup?')
await page.click('button:has-text("Restore"):visible >> nth=-1')
await page.waitForSelector('text=Data restored from backup', { timeout: 10000 })
await page.goto('http://localhost:5173/accounts')
await page.waitForSelector('text=Cash & Bank', { timeout: 10000 })
await shot('2-after-restore')
console.log('JSON restore round-trip: OK')

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
