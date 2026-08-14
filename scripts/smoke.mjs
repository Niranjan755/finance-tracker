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

async function addAccount({ name, institution, type, balance, creditLimit }) {
  await page.getByRole('button', { name: 'Add Account' }).first().click()
  await page.waitForSelector('#acct-name')
  await page.fill('#acct-name', name)
  await page.fill('#acct-institution', institution)
  if (type) {
    await page.click('#acct-type')
    await page.click(`[role="option"]:has-text("${type}")`)
  }
  if (creditLimit) {
    await page.waitForSelector('#acct-limit')
    await page.fill('#acct-limit', creditLimit)
  }
  await page.fill('#acct-balance', balance)
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Add Account' }).click()
  await page.waitForSelector(`text=${name}`, { timeout: 10000 })
}

async function addExpense({ account, category, merchant, amount }) {
  await page.click('button:has-text("Add Transaction")')
  await page.getByRole('menuitem', { name: 'Add Expense' }).click()
  await page.waitForSelector('#expense-amount')
  await page.fill('#expense-amount', amount)
  await page.click(`[role="radiogroup"][aria-label="Paid with"] >> text=${account}`)
  await page.click('#expense-category')
  await page.waitForSelector('[role="option"]')
  await page.click(`[role="option"]:has-text("${category}")`)
  await page.fill('#expense-merchant', merchant)
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Expense' }).click()
  await page.waitForSelector('text=Expense added', { timeout: 10000 })
}

async function addIncome({ account, category, merchant, amount }) {
  await page.click('button:has-text("Add Transaction")')
  await page.getByRole('menuitem', { name: 'Add Income' }).click()
  await page.waitForSelector('#income-amount')
  await page.fill('#income-amount', amount)
  await page.click(`[role="radiogroup"][aria-label="Received into"] >> text=${account}`)
  await page.click('#income-category')
  await page.waitForSelector('[role="option"]')
  await page.click(`[role="option"]:has-text("${category}")`)
  await page.fill('#income-merchant', merchant)
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Income' }).click()
  await page.waitForSelector('text=Income added', { timeout: 10000 })
}

await addAccount({ name: 'Chase Checking', institution: 'Chase', balance: '5000' })
await addAccount({ name: 'Chase Sapphire', institution: 'Chase', type: 'Credit Card', balance: '0', creditLimit: '5000' })

await addIncome({ account: 'Chase Checking', category: 'Salary', merchant: 'Employer Inc', amount: '4200' })
await addExpense({ account: 'Chase Sapphire', category: 'Restaurants', merchant: 'Olive Garden', amount: '85.40' })
await addExpense({ account: 'Chase Checking', category: 'Groceries', merchant: 'Whole Foods', amount: '120' })
await addExpense({ account: 'Chase Checking', category: 'Rent', merchant: 'Landlord', amount: '2000' })
await addExpense({ account: 'Chase Sapphire', category: 'Streaming', merchant: 'Netflix', amount: '22.99' })

await page.goto('http://localhost:5173/')
await page.waitForSelector('text=Net Worth')
await page.waitForSelector('text=Income vs Expenses')
await page.waitForTimeout(800) // let recharts finish measuring/animating
await shot('dashboard-with-charts')

// Toggle date range and dark mode too, while we're here.
await page.click('button:has-text("7D")')
await page.waitForTimeout(500)
await shot('dashboard-7d-range')

await page.click('button[aria-label="Change theme"]')
await page.getByRole('menuitem', { name: 'Dark' }).click()
await page.waitForTimeout(400)
await shot('dashboard-dark-mode')

// Click a donut legend entry to confirm the category-filter link works.
const breakdownCard = page.locator('text=Expense Breakdown').locator('..')
await breakdownCard.getByRole('button', { name: /Food/ }).click()
await page.waitForURL('**/transactions?category=**')
await shot('transactions-filtered-by-category')

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
