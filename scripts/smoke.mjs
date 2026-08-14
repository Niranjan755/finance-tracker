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

await page.goto('http://localhost:5173')
await page.waitForSelector('text=Welcome to Finance Tracker')
await page.click('text=Add an Account')
await page.waitForURL('**/accounts')

await page.getByRole('button', { name: 'Add Account' }).first().click()
await page.waitForSelector('#acct-name')
await page.fill('#acct-name', 'Chase Checking')
await page.fill('#acct-balance', '3000')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Add Account' }).click()
await page.waitForSelector('text=Chase Checking', { timeout: 10000 })

// --- Budgets ---
await page.goto('http://localhost:5173/budgets')
await page.click('button:has-text("Add Budget")')
await page.waitForSelector('#budget-category')
await page.click('#budget-category')
await page.click('[role="option"]:has-text("Food")')
await page.fill('#budget-amount', '600')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Create Budget' }).click()
await page.waitForSelector('text=Budget created', { timeout: 10000 })
await shot('1-budget-created')

// Add an expense in Food > Groceries to see the progress bar move.
await page.click('button:has-text("Add Transaction")')
await page.getByRole('menuitem', { name: 'Add Expense' }).click()
await page.waitForSelector('#expense-amount')
await page.fill('#expense-amount', '425')
await page.click('[role="radiogroup"][aria-label="Paid with"] >> text=Chase Checking')
await page.click('#expense-category')
await page.click('[role="option"]:has-text("Groceries")')
await page.fill('#expense-merchant', 'Whole Foods')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Expense' }).click()
await page.waitForSelector('text=Expense added', { timeout: 10000 })

await page.goto('http://localhost:5173/budgets')
await page.waitForSelector('text=$425.00')
await shot('2-budget-progress')

// --- Recurring / Upcoming ---
await page.goto('http://localhost:5173/upcoming')
await page.click('button:has-text("Add Recurring")')
await page.waitForSelector('#rec-name')
await page.fill('#rec-name', 'Rent')
await page.fill('#rec-amount', '2000')
await page.click('#rec-account')
await page.locator('[role="option"]:visible', { hasText: 'Chase Checking' }).last().click()
await page.click('#rec-category')
await page.locator('[role="option"]:visible', { hasText: 'Rent' }).last().click()
// Set start date to a few days from now so it shows as upcoming, not overdue.
await page.fill('#rec-start', '2026-08-20')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Add Recurring Transaction' }).click()
await page.waitForSelector('text=Recurring transaction added', { timeout: 10000 })
await shot('3-recurring-added')

const bodyText = await page.locator('body').innerText()
console.log('UPCOMING PAGE TEXT SNAPSHOT:\n', bodyText)

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
