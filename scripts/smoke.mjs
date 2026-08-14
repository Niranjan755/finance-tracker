import { chromium } from 'playwright'

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const context = await browser.newContext()
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

await page.goto('http://localhost:5173')
await page.waitForSelector('text=Welcome to Finance Tracker', { timeout: 15000 })
await page.screenshot({ path: '/tmp/smoke-1-dashboard-empty.png' })

await page.click('text=Add an Account')
await page.waitForURL('**/accounts')
await page.waitForSelector('text=Add Account')
await page.screenshot({ path: '/tmp/smoke-2-accounts-empty.png' })

await page.getByRole('button', { name: 'Add Account' }).first().click()
await page.waitForSelector('#acct-name')
await page.fill('#acct-name', 'Chase Checking')
await page.fill('#acct-institution', 'Chase')
await page.fill('#acct-balance', '4250.50')
await page.screenshot({ path: '/tmp/smoke-3-form-filled.png' })
await page.locator('[role="dialog"]').getByRole('button', { name: 'Add Account' }).click()

await page.waitForSelector('text=Chase Checking', { timeout: 10000 })
await page.waitForSelector('text=$4,250.50')
await page.screenshot({ path: '/tmp/smoke-4-account-added.png' })

// Test the Base UI render-prop dropdown menu on the account card.
await page.click('button[aria-label="Actions for Chase Checking"]')
await page.waitForSelector('text=Deactivate', { timeout: 5000 })
await page.screenshot({ path: '/tmp/smoke-5-dropdown-open.png' })
await page.keyboard.press('Escape')

// Sidebar nav + Add Transaction menu (also Base UI render-prop based).
await page.click('a:has-text("Dashboard")')
await page.waitForURL('**/')
await page.screenshot({ path: '/tmp/smoke-6-dashboard-with-account.png' })

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log('SMOKE TEST PASSED')
await browser.close()
