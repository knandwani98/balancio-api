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

  async monthlyDashboard(projectId: string, year: number, monthIndex0: number) {
    const monthStart = startOfMonthUTC(year, monthIndex0);
    const monthEnd = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = toISODate(monthStart);
    const to = toISODate(monthEnd);

    const sums = await this.transactions.sumByTypeInMonth(projectId, year, monthIndex0);
    const byCat = await this.transactions.sumExpenseByCategoryInMonth(projectId, year, monthIndex0);
    const cats = await this.categories.list(projectId);
    const catNames = new Map(cats.map((c) => [c.id, c.name]));

    const category_breakdown = Array.from(byCat.entries()).map(([category_id, total]) => ({
      category_id,
      name: category_id ? (catNames.get(category_id) ?? "Unknown") : "Uncategorized",
      amount: total,
    }));

    const budgetList = await this.budgets.list(projectId);
    let planned_expense = 0;
    for (const b of budgetList) {
      const virtual = computeOccurrences(b, from, to);
      const dbRows = await this.occurrences.listForBudgetInRange(b.id, from, to);
      const merged = mergeOccurrences(virtual, dbRows);
      for (const o of merged) {
        planned_expense += o.planned_amount;
      }
    }

    return {
      month: { year, month: monthIndex0 + 1 },
      income: sums.income,
      expense: sums.expense,
      net: sums.income - sums.expense,
      planned_expense,
      planned_vs_actual_variance: planned_expense - sums.expense,
      category_breakdown,
    };
  }
}
