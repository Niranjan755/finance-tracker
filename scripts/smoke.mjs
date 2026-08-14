import { chromium, devices } from 'playwright'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext({ ...devices['iPhone 13'] })
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

async function shot(name) {
  await page.screenshot({ path: `/tmp/smoke-mobile-${name}.png` })
}

await page.goto('http://localhost:5173')
await page.waitForSelector('text=Welcome to Finance Tracker')
await page.click('button:has-text("Explore with Demo Data")')
await page.waitForSelector('text=Net Worth', { timeout: 15000 })
await page.waitForTimeout(500)
await shot('1-dashboard')

// Bottom nav should be visible, sidebar should not.
const bottomNavVisible = await page.locator('nav[aria-label="Primary"]').isVisible()
const sidebarVisible = await page
  .locator('[data-slot="sidebar"]')
  .first()
  .isVisible()
  .catch(() => false)
console.log('bottom nav visible:', bottomNavVisible, '| desktop sidebar visible:', sidebarVisible)

// Tap the center "+" to open the quick-add drawer.
await page.click('button[aria-label="Add transaction"]')
await page.waitForSelector('text=Add Expense')
await shot('2-mobile-add-drawer')
await page.keyboard.press('Escape')

// Transactions page should render as cards, not an overflowing table.
await page.click('a:has-text("Transactions")')
await page.waitForSelector('text=Transactions')
await page.waitForTimeout(300)
await shot('3-mobile-transactions')
const tableVisible = await page
  .locator('table')
  .first()
  .isVisible()
  .catch(() => false)
console.log('desktop table visible on mobile (should be false):', tableVisible)
const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
const viewportWidth = await page.evaluate(() => window.innerWidth)
console.log(
  `body scrollWidth=${bodyWidth} viewportWidth=${viewportWidth} (no horizontal overflow if equal)`,
)

// Accounts page.
await page.click('a:has-text("Accounts")')
await page.waitForSelector('text=Accounts')
await shot('4-mobile-accounts')

// Dashboard charts should still render (not fixed desktop widths breaking layout).
await page.click('a:has-text("Home")')
await page.waitForSelector('text=Net Worth')
await page.waitForTimeout(500)
await shot('5-mobile-dashboard-charts')

// More drawer.
await page.click('button:has-text("More")')
await page.waitForSelector('text=Budgets')
await shot('6-mobile-more-drawer')

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
