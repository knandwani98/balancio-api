import type { CategoryKind } from "@prisma/client";

export const CATEGORY_SEED_VERSION = 1;

export type DefaultCategorySeed = {
  name: string;
  icon: string;
  type: CategoryKind;
};

/** Canonical default categories (expense + income + neutral). Seeded on every new project. */
export const DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
  { name: "ATM", icon: "landmark", type: "expense" },
  { name: "Bills & utilities", icon: "receipt", type: "expense" },
  { name: "Charity", icon: "heart-handshake", type: "expense" },
  { name: "Commute", icon: "bus", type: "expense" },
  { name: "Credit bills", icon: "credit-card", type: "expense" },
  { name: "EMIs & Loans", icon: "badge-indian-rupee", type: "expense" },
  { name: "Education", icon: "graduation-cap", type: "expense" },
  { name: "Entertainment", icon: "film", type: "expense" },
  { name: "Family & pets", icon: "paw-print", type: "expense" },
  { name: "Fees & charges", icon: "file-warning", type: "expense" },
  { name: "Finance", icon: "wallet", type: "expense" },
  { name: "Fitness", icon: "dumbbell", type: "expense" },
  { name: "Food & drinks", icon: "utensils-crossed", type: "expense" },
  { name: "Fuel", icon: "fuel", type: "expense" },
  { name: "Groceries", icon: "shopping-cart", type: "expense" },
  { name: "Household", icon: "home", type: "expense" },
  { name: "Insurance", icon: "shield-check", type: "expense" },
  { name: "Medical", icon: "heart-pulse", type: "expense" },
  { name: "Miscellaneous", icon: "shapes", type: "expense" },
  { name: "Money transfers", icon: "arrow-left-right", type: "expense" },
  { name: "Personal care", icon: "sparkles", type: "expense" },
  { name: "Rent", icon: "building-2", type: "expense" },
  { name: "Shopping", icon: "shopping-bag", type: "expense" },
  { name: "Travel", icon: "plane", type: "expense" },
  { name: "Wallets", icon: "wallet-cards", type: "expense" },
  { name: "Investments", icon: "chart-column", type: "income" },
  { name: "Bill repayment", icon: "receipt", type: "income" },
  { name: "Cashback", icon: "badge-percent", type: "income" },
  { name: "Credit", icon: "circle-dollar-sign", type: "income" },
  { name: "EMIs & Loans", icon: "badge-indian-rupee", type: "income" },
  { name: "Gift", icon: "gift", type: "income" },
  { name: "Income", icon: "banknote-arrow-up", type: "income" },
  { name: "Insurance", icon: "shield-check", type: "income" },
  { name: "Interest", icon: "piggy-bank", type: "income" },
  { name: "Miscellaneous", icon: "shapes", type: "income" },
  { name: "Money transfers", icon: "arrow-left-right", type: "income" },
  { name: "Pots withdrawal", icon: "wallet-minimal", type: "income" },
  { name: "Refund", icon: "rotate-ccw", type: "income" },
  { name: "Rewards", icon: "badge-check", type: "income" },
  { name: "Salary", icon: "wallet", type: "income" },
  { name: "Self Transfers", icon: "repeat", type: "neutral" },
] as const;
