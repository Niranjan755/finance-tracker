import { chromium } from 'playwright'

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

// --- Full onboarding wizard ---
await page.goto('http://localhost:5173')
await page.waitForSelector('text=Welcome to Finance Tracker')
await shot('1-onboarding-welcome')

await page.click('button:has-text("Get Started")')
await page.waitForSelector('text=Select Your Currency')
await shot('2-onboarding-currency')

await page.click('button:has-text("Continue")')
await page.waitForSelector('text=Add Your First Account')
await page.fill('#acct-name', 'Chase Checking')
await page.fill('#acct-balance', '2500')
await page.locator('form').getByRole('button', { name: 'Add Account' }).click()
await page.waitForSelector('text=Add Your First Transaction', { timeout: 10000 })
await shot('3-onboarding-transaction')

await page.fill('#expense-amount', '42.50')
await page.click('[role="radiogroup"][aria-label="Paid with"] >> text=Chase Checking')
await page.click('#expense-category')
await page.locator('[role="option"]:visible', { hasText: 'Restaurants' }).last().click()
await page.fill('#expense-merchant', 'Local Diner')
await page.locator('form').getByRole('button', { name: 'Save Expense' }).click()
await page.waitForSelector("text=You're ready!", { timeout: 10000 })
await shot('4-onboarding-done')

await page.click('button:has-text("Go to Dashboard")')
await page.waitForSelector('text=Net Worth')
await shot('5-dashboard-after-onboarding')

// Reload the page entirely - onboarding must not show again, and lazy-loaded
// routes must still work after a full page (re)hydration.
await page.reload()
await page.waitForSelector('text=Net Worth', { timeout: 10000 })
console.log('onboarding did not reappear after reload: OK')

// Navigate through a few lazy-loaded routes to confirm Suspense/chunking works.
for (const path of ['/transactions', '/accounts', '/budgets', '/reports', '/settings']) {
  await page.goto(`http://localhost:5173${path}`)
  await page.waitForLoadState('networkidle')
}
console.log('all lazy routes loaded without error')

// --- Keyboard accessibility spot check: open Add Transaction via 'n', Escape closes it ---
await page.goto('http://localhost:5173/')
await page.waitForSelector('text=Net Worth')
await page.keyboard.press('n')
await page.waitForSelector('[role="dialog"]')
await page.keyboard.press('Escape')
await page.waitForSelector('[role="dialog"]', { state: 'hidden' })
console.log('keyboard shortcut (n) + Escape-to-close: OK')

// Tab order sanity: focus should land on an interactive element, not get lost.
await page.keyboard.press('Tab')
const active = await page.evaluate(() => document.activeElement?.tagName)
console.log('first Tab stop tag:', active)

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
