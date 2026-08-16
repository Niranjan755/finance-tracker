/**
 * Maps Plaid's "personal finance category" taxonomy to this app's default
 * category ids (src/lib/db/seed/categories.ts). Mapped at the `primary`
 * level only, which is a small, stable set - Plaid's `detailed` categories
 * are far more numerous and could give finer-grained mapping later (e.g.
 * distinguishing groceries from restaurants), but guessing at exact
 * `detailed` enum strings without verifying them against Plaid's published
 * taxonomy risks silent mismatches, so this stays at the safer, well-known
 * `primary` level for now and falls back to "Other" for anything unmapped.
 */
const PRIMARY_CATEGORY_MAP: Record<string, string> = {
  FOOD_AND_DRINK: 'cat_exp_food_restaurants',
  TRANSPORTATION: 'cat_exp_transportation_gas',
  RENT_AND_UTILITIES: 'cat_exp_housing_rent',
  GENERAL_MERCHANDISE: 'cat_exp_shopping_amazon',
  ENTERTAINMENT: 'cat_exp_entertainment_streaming',
  MEDICAL: 'cat_exp_health_doctor',
  PERSONAL_CARE: 'cat_exp_shopping_personal-care',
  TRAVEL: 'cat_exp_travel_flights',
  HOME_IMPROVEMENT: 'cat_exp_housing_home-maintenance',
  LOAN_PAYMENTS: 'cat_exp_other',
  BANK_FEES: 'cat_exp_other',
  GENERAL_SERVICES: 'cat_exp_other',
  GOVERNMENT_AND_NON_PROFIT: 'cat_exp_other',
  INCOME: 'cat_inc_salary',
  TRANSFER_IN: 'cat_inc_other-income',
  TRANSFER_OUT: 'cat_exp_other',
}

const FALLBACK_EXPENSE_CATEGORY_ID = 'cat_exp_other'
const FALLBACK_INCOME_CATEGORY_ID = 'cat_inc_other-income'

export function mapPlaidCategory(primary: string | undefined, isIncome: boolean): string {
  if (primary && PRIMARY_CATEGORY_MAP[primary]) {
    return PRIMARY_CATEGORY_MAP[primary]
  }
  return isIncome ? FALLBACK_INCOME_CATEGORY_ID : FALLBACK_EXPENSE_CATEGORY_ID
}
