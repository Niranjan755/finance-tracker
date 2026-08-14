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
await page.fill('#acct-balance', '8450')
await page.locator('[role="dialog"]').getByRole('button', { name: 'Add Account' }).click()
await page.waitForSelector('text=Chase Checking', { timeout: 10000 })

async function addIncome({ amount, category, merchant }) {
  await page.click('button:has-text("Add Transaction")')
  await page.getByRole('menuitem', { name: 'Add Income' }).click()
  await page.waitForSelector('#income-amount')
  await page.fill('#income-amount', amount)
  await page.click('[role="radiogroup"][aria-label="Received into"] >> text=Chase Checking')
  await page.click('#income-category')
  await page.locator('[role="option"]:visible', { hasText: category }).last().click()
  await page.fill('#income-merchant', merchant)
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Income' }).click()
  await page.waitForSelector('text=Income added', { timeout: 10000 })
}

async function addExpense({ amount, category, merchant }) {
  await page.click('button:has-text("Add Transaction")')
  await page.getByRole('menuitem', { name: 'Add Expense' }).click()
  await page.waitForSelector('#expense-amount')
  await page.fill('#expense-amount', amount)
  await page.click('[role="radiogroup"][aria-label="Paid with"] >> text=Chase Checking')
  await page.click('#expense-category')
  await page.locator('[role="option"]:visible', { hasText: category }).last().click()
  await page.fill('#expense-merchant', merchant)
  await page.locator('[role="dialog"]').getByRole('button', { name: 'Save Expense' }).click()
  await page.waitForSelector('text=Expense added', { timeout: 10000 })
}

await addIncome({ amount: '9050', category: 'Salary', merchant: 'Employer Inc' })
await addExpense({ amount: '4180', category: 'Groceries', merchant: 'Whole Foods' })

await page.goto('http://localhost:5173/reports')
await page.waitForSelector('text=Financial Statement')
await shot('1-report-statement')

const bodyText = await page.locator('body').innerText()
console.log('REPORTS PAGE TEXT SNAPSHOT:\n', bodyText)

const [csvDownload] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("CSV")')])
console.log('CSV download filename:', csvDownload.suggestedFilename())

const [pdfDownload] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("PDF")')])
console.log('PDF download filename:', pdfDownload.suggestedFilename())
await pdfDownload.saveAs('/tmp/statement-test.pdf')

const [xlsxDownload] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Excel")')])
console.log('Excel download filename:', xlsxDownload.suggestedFilename())

console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log(errors.length === 0 ? 'SMOKE TEST PASSED' : 'SMOKE TEST HAD CONSOLE ERRORS')
await browser.close()
