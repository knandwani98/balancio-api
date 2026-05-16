import type { CategoryKind } from "@prisma/client";

export const CATEGORY_SEED_VERSION = 1;

export type DefaultCategorySeed = {
  name: string;
  icon: string;
  type: CategoryKind;
};

/** Canonical default categories (expense + income + neutral). Seeded on every new project. */
export const DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
  { name: "ATM", icon: "🏦", type: "expense" },
  { name: "Bills & utilities", icon: "🧾", type: "expense" },
  { name: "Charity", icon: "🤝", type: "expense" },
  { name: "Commute", icon: "🚌", type: "expense" },
  { name: "Credit bills", icon: "💳", type: "expense" },
  { name: "EMIs & Loans", icon: "💰", type: "expense" },
  { name: "Education", icon: "🎓", type: "expense" },
  { name: "Entertainment", icon: "🎬", type: "expense" },
  { name: "Family & pets", icon: "🐾", type: "expense" },
  { name: "Fees & charges", icon: "⚠️", type: "expense" },
  { name: "Finance", icon: "👛", type: "expense" },
  { name: "Fitness", icon: "🏋️", type: "expense" },
  { name: "Food & drinks", icon: "🍽️", type: "expense" },
  { name: "Fuel", icon: "⛽", type: "expense" },
  { name: "Groceries", icon: "🛒", type: "expense" },
  { name: "Household", icon: "🏠", type: "expense" },
  { name: "Insurance", icon: "🛡️", type: "expense" },
  { name: "Medical", icon: "❤️‍🩹", type: "expense" },
  { name: "Miscellaneous", icon: "🔷", type: "expense" },
  { name: "Money transfers", icon: "🔄", type: "expense" },
  { name: "Personal care", icon: "✨", type: "expense" },
  { name: "Rent", icon: "🏢", type: "expense" },
  { name: "Shopping", icon: "🛍️", type: "expense" },
  { name: "Travel", icon: "✈️", type: "expense" },
  { name: "Wallets", icon: "👝", type: "expense" },
  { name: "Investments", icon: "📈", type: "income" },
  { name: "Bill repayment", icon: "🧾", type: "income" },
  { name: "Cashback", icon: "💸", type: "income" },
  { name: "Credit", icon: "💵", type: "income" },
  { name: "EMIs & Loans", icon: "💰", type: "income" },
  { name: "Gift", icon: "🎁", type: "income" },
  { name: "Income", icon: "📥", type: "income" },
  { name: "Insurance", icon: "🛡️", type: "income" },
  { name: "Interest", icon: "🐷", type: "income" },
  { name: "Miscellaneous", icon: "🔷", type: "income" },
  { name: "Money transfers", icon: "🔄", type: "income" },
  { name: "Pots withdrawal", icon: "👛", type: "income" },
  { name: "Refund", icon: "↩️", type: "income" },
  { name: "Rewards", icon: "🏅", type: "income" },
  { name: "Salary", icon: "💼", type: "income" },
  { name: "Self Transfers", icon: "🔁", type: "neutral" },
] as const;
