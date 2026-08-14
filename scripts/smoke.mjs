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

// --- Demo data via onboarding-adjacent Settings flow ---
// First create one throwaway account so we land past onboarding, then load demo data.
await page.goto('http://localhost:5173')
await page.waitForSelector('text=Welcome to Finance Tracker')
await page.click('text=Add an Account')
await page.waitForURL('**/accounts')
await page.getByRole('button', { name: 'Add Account' }).first().click()
await page.waitForSelector('#acct-name')
await page.fill('#acct-name', 'Temp')
await page.fill('#acct-balance', '0')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Add Account' }).click()
await page.waitForSelector('text=Temp', { timeout: 10000 })

await page.goto('http://localhost:5173/settings')
await page.click('button:has-text("Load Demo Data")')
await page.click('button:has-text("Load Demo Data"):visible >> nth=-1')
await page.waitForSelector('text=Demo data loaded', { timeout: 10000 })
await shot('1-settings-after-demo')

await page.goto('http://localhost:5173/')
await page.waitForSelector('text=Net Worth')
await shot('2-dashboard-with-demo-data')

// --- Analytics with real data ---
await page.goto('http://localhost:5173/analytics')
await page.waitForSelector('text=Insights')
await shot('3-analytics')

// --- Calendar ---
await page.goto('http://localhost:5173/calendar')
await page.waitForSelector('text=Calendar')
await shot('4-calendar')

// --- Transactions: tag filter presence (demo data has no tags, so just confirm page still works) + receipt attach ---
await page.goto('http://localhost:5173/transactions')
await page.waitForSelector('table')
const firstRow = page.locator('tbody tr').first()
await firstRow.click()
await page.waitForSelector('text=Transaction ID')
await shot('5-transaction-detail-with-receipt-section')

// Attach a receipt (use this repo's own package.json as a stand-in "image" won't validate type, so build a tiny real PNG).
const pngPath = '/tmp/tiny-receipt.png'
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
fs.writeFileSync(pngPath, Buffer.from(pngBase64, 'base64'))
const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("Add Receipt")')])
await fileChooser.setFiles(pngPath)
await page.waitForSelector('text=Receipt attached', { timeout: 10000 })
await shot('6-receipt-attached')

// --- Settings: export JSON, export CSV ---
await page.goto('http://localhost:5173/settings')
const [jsonDownload] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export JSON Backup")')])
console.log('JSON backup filename:', jsonDownload.suggestedFilename())
await jsonDownload.saveAs('/tmp/backup-test.json')

const [csvDownload] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export CSV")')])
console.log('CSV export filename:', csvDownload.suggestedFilename())

// --- Categories: add + delete a custom category ---
await page.fill('input[placeholder="New category name"]', 'Pet Supplies')
await page.getByRole('button', { name: 'Add', exact: true }).click()
await page.waitForSelector('text=Category added', { timeout: 10000 })
await shot('7-custom-category-added')
await page.click('button[aria-label="Delete Pet Supplies"]')
await page.waitForSelector('text=Category deleted', { timeout: 10000 })

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
