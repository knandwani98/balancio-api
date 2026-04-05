import type { BudgetRepository } from "../repositories/budgetRepository.js";
import type { BudgetOccurrenceRepository } from "../repositories/budgetOccurrenceRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import { computeOccurrences, mergeOccurrences } from "./budgetOccurrenceService.js";
import { startOfMonthUTC, toISODate } from "../utils/dates.js";

export class AnalyticsService {
  constructor(
    private budgets: BudgetRepository,
    private occurrences: BudgetOccurrenceRepository,
    private transactions: TransactionRepository,
    private categories: CategoryRepository
  ) {}

  async monthlyDashboard(userId: string, year: number, monthIndex0: number) {
    const monthStart = startOfMonthUTC(year, monthIndex0);
    const monthEnd = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = toISODate(monthStart);
    const to = toISODate(monthEnd);

    const sums = await this.transactions.sumByTypeInMonth(userId, year, monthIndex0);
    const byCat = await this.transactions.sumExpenseByCategoryInMonth(userId, year, monthIndex0);
    const cats = await this.categories.list(userId);
    const catTitles = new Map(cats.map((c) => [c.id, c.title]));

    const category_breakdown = Array.from(byCat.entries()).map(([category_id, amount_paise]) => ({
      category_id,
      title: category_id ? (catTitles.get(category_id) ?? "Unknown") : "Uncategorized",
      expense_paise: amount_paise,
    }));

    const budgetList = await this.budgets.list(userId);
    let planned_expense_paise = 0;
    for (const b of budgetList) {
      const virtual = computeOccurrences(b, from, to);
      const dbRows = await this.occurrences.listForBudgetInRange(b.id, from, to);
      const merged = mergeOccurrences(virtual, dbRows);
      for (const o of merged) {
        planned_expense_paise += o.planned_amount_paise;
      }
    }

    return {
      month: { year, month: monthIndex0 + 1 },
      income_paise: sums.income_paise,
      expense_paise: sums.expense_paise,
      net_paise: sums.income_paise - sums.expense_paise,
      planned_expense_paise,
      planned_vs_actual_variance_paise: planned_expense_paise - sums.expense_paise,
      category_breakdown,
    };
  }
}
