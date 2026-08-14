import type { Category } from '@/types'

function cat(
  id: string,
  name: string,
  type: Category['type'],
  icon: string,
  color: string,
  parentId: string | null = null,
): Category {
  return { id, name, type, parentId, icon, color, isDefault: true }
}

const EXPENSE_GROUPS: {
  id: string
  name: string
  icon: string
  color: string
  children: { id: string; name: string }[]
}[] = [
  {
    id: 'housing',
    name: 'Housing',
    icon: 'home',
    color: '#f59e0b',
    children: [
      { id: 'rent', name: 'Rent' },
      { id: 'mortgage', name: 'Mortgage' },
      { id: 'property-tax', name: 'Property Tax' },
      { id: 'home-maintenance', name: 'Home Maintenance' },
    ],
  },
  {
    id: 'food',
    name: 'Food',
    icon: 'utensils',
    color: '#ef4444',
    children: [
      { id: 'groceries', name: 'Groceries' },
      { id: 'restaurants', name: 'Restaurants' },
      { id: 'fast-food', name: 'Fast Food' },
      { id: 'coffee', name: 'Coffee' },
    ],
  },
  {
    id: 'transportation',
    name: 'Transportation',
    icon: 'car',
    color: '#3b82f6',
    children: [
      { id: 'gas', name: 'Gas' },
      { id: 'uber', name: 'Uber' },
      { id: 'lyft', name: 'Lyft' },
      { id: 'public-transit', name: 'Public Transportation' },
      { id: 'car-maintenance', name: 'Car Maintenance' },
      { id: 'parking', name: 'Parking' },
    ],
  },
  {
    id: 'bills',
    name: 'Bills & Utilities',
    icon: 'receipt',
    color: '#8b5cf6',
    children: [
      { id: 'electricity', name: 'Electricity' },
      { id: 'water', name: 'Water' },
      { id: 'internet', name: 'Internet' },
      { id: 'phone', name: 'Phone' },
      { id: 'insurance', name: 'Insurance' },
    ],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: 'shopping-bag',
    color: '#ec4899',
    children: [
      { id: 'clothing', name: 'Clothing' },
      { id: 'electronics', name: 'Electronics' },
      { id: 'amazon', name: 'Amazon' },
      { id: 'personal-care', name: 'Personal Care' },
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: 'clapperboard',
    color: '#14b8a6',
    children: [
      { id: 'movies', name: 'Movies' },
      { id: 'games', name: 'Games' },
      { id: 'streaming', name: 'Streaming' },
      { id: 'events', name: 'Events' },
    ],
  },
  {
    id: 'health',
    name: 'Health',
    icon: 'heart-pulse',
    color: '#22c55e',
    children: [
      { id: 'doctor', name: 'Doctor' },
      { id: 'pharmacy', name: 'Pharmacy' },
      { id: 'dental', name: 'Dental' },
      { id: 'fitness', name: 'Fitness' },
    ],
  },
  {
    id: 'travel',
    name: 'Travel',
    icon: 'plane',
    color: '#06b6d4',
    children: [
      { id: 'flights', name: 'Flights' },
      { id: 'hotels', name: 'Hotels' },
      { id: 'rental-car', name: 'Rental Car' },
      { id: 'travel-food', name: 'Food' },
    ],
  },
]

const INCOME_CATEGORIES: { id: string; name: string; icon: string; color: string }[] = [
  { id: 'salary', name: 'Salary', icon: 'wallet', color: '#22c55e' },
  { id: 'freelance', name: 'Freelance', icon: 'briefcase', color: '#06b6d4' },
  { id: 'business', name: 'Business', icon: 'store', color: '#8b5cf6' },
  { id: 'investment', name: 'Investment', icon: 'trending-up', color: '#f59e0b' },
  { id: 'gift', name: 'Gift', icon: 'gift', color: '#ec4899' },
  { id: 'refund', name: 'Refund', icon: 'rotate-ccw', color: '#3b82f6' },
  { id: 'other-income', name: 'Other Income', icon: 'circle-dollar-sign', color: '#6b7280' },
]

export function getDefaultCategories(): Category[] {
  const categories: Category[] = []

  for (const group of EXPENSE_GROUPS) {
    const groupId = `cat_exp_${group.id}`
    categories.push(cat(groupId, group.name, 'expense', group.icon, group.color))
    for (const child of group.children) {
      categories.push(
        cat(`${groupId}_${child.id}`, child.name, 'expense', group.icon, group.color, groupId),
      )
    }
  }
  categories.push(cat('cat_exp_other', 'Other', 'expense', 'more-horizontal', '#6b7280'))

  for (const income of INCOME_CATEGORIES) {
    categories.push(cat(`cat_inc_${income.id}`, income.name, 'income', income.icon, income.color))
  }

  return categories
}
