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
  await page.screenshot({ path: `/tmp/smoke-${name}.png` })
}

// --- Onboarding: create two accounts ---
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

await addAccount({ name: 'Chase Checking', institution: 'Chase', balance: '1000' })
await addAccount({ name: 'Chase Sapphire', institution: 'Chase', type: 'Credit Card', balance: '0', creditLimit: '5000' })
await shot('1-two-accounts')

// --- Add an expense on the credit card ---
await page.click('button:has-text("Add Transaction")')
await page.getByRole('menuitem', { name: 'Add Expense' }).click()
await page.waitForSelector('#expense-amount')
await page.fill('#expense-amount', '85.40')
await page.click('[role="radiogroup"][aria-label="Paid with"] >> text=Chase Sapphire')
await page.click('#expense-category')
await page.waitForSelector('[role="option"]')
await page.click('[role="option"]:has-text("Restaurants")')
await page.fill('#expense-merchant', 'Olive Garden')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Expense' }).click()
await page.waitForSelector('text=Expense added', { timeout: 10000 })
await shot('2-expense-added')

await page.goto('http://localhost:5173/accounts')
await page.waitForSelector('text=$85.40')
await shot('3-cc-balance-after-expense')

// --- Add income to checking ---
await page.click('button:has-text("Add Transaction")')
await page.getByRole('menuitem', { name: 'Add Income' }).click()
await page.waitForSelector('#income-amount')
await page.fill('#income-amount', '4200')
await page.click('[role="radiogroup"][aria-label="Received into"] >> text=Chase Checking')
await page.click('#income-category')
await page.waitForSelector('[role="option"]')
await page.click('[role="option"]:has-text("Salary")')
await page.fill('#income-merchant', 'Employer Inc')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Income' }).click()
await page.waitForSelector('text=Income added', { timeout: 10000 })

// --- Transfer / credit card payment: checking -> credit card ---
await page.click('button:has-text("Add Transaction")')
await page.getByRole('menuitem', { name: 'Transfer Money' }).click()
await page.waitForSelector('#transfer-amount')
await page.fill('#transfer-amount', '85.40')
await page.click('[role="radiogroup"][aria-label="From account"] >> text=Chase Checking')
await page.click('[role="radiogroup"][aria-label="To account"] >> text=Chase Sapphire')
await page.waitForSelector('text=recorded as a credit card payment')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Transfer Money' }).click()
await page.waitForSelector('text=Transfer completed', { timeout: 10000 })

await page.goto('http://localhost:5173/accounts')
await shot('4-after-payment')
const bodyText = await page.locator('body').innerText()
console.log('ACCOUNTS PAGE TEXT SNAPSHOT:\n', bodyText)

// --- Transactions page: verify list + detail sheet + edit ---
await page.goto('http://localhost:5173/transactions')
await page.waitForSelector('text=Olive Garden')
await shot('5-transactions-list')
await page.click('text=Olive Garden')
await page.waitForSelector('text=Transaction ID')
await shot('6-transaction-detail')
await page.click('button:has-text("Edit")')
await page.waitForSelector('#expense-amount')
await page.fill('#expense-amount', '90.00')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Changes' }).click()
await page.waitForSelector('text=Transaction updated', { timeout: 10000 })
await shot('7-after-edit')

// --- Dashboard check ---
await page.goto('http://localhost:5173/')
await page.waitForSelector('text=Net Worth')
await shot('8-dashboard')

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
