import type { BudgetRepository } from "../repositories/budgetRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import { computeOccurrences, mergeOccurrences } from "./budgetOccurrenceService.js";
import type { MergedOccurrence } from "./budgetOccurrenceService.js";
import { budgetPlanningRangeEnd, startOfMonthUTC, toISODate } from "../utils/dates.js";

function isUnpaidOccurrence(o: MergedOccurrence): boolean {
  return o.schedule_status !== "DONE";
}

export class AnalyticsService {
  constructor(
    private budgets: BudgetRepository,
    private transactions: TransactionRepository,
    private categories: CategoryRepository
  ) {}

  async rangeDashboard(projectId: string, from: string, to: string) {
    const sums = await this.transactions.sumByTypeInRange(projectId, from, to);
    const byCat = await this.transactions.sumExpenseByCategoryInRange(projectId, from, to);
    const cats = await this.categories.list(projectId);
    const catNames = new Map(cats.map((c) => [c.id, c.name]));

    const category_breakdown = Array.from(byCat.entries()).map(([category_id, total]) => ({
      category_id,
      name: category_id ? (catNames.get(category_id) ?? "Unknown") : "Uncategorized",
      amount: total,
    }));

    const budgetList = await this.budgets.list(projectId);
    const catKind = new Map(cats.map((c) => [c.id, c.kind]));
    const planningTo = budgetPlanningRangeEnd(from, to);
    let planned_expense = 0;
    let planned_income = 0;
    let pending_planned_expense = 0;
    for (const b of budgetList) {
      const virtual = computeOccurrences(b, from, planningTo);
      const dbRows = await this.transactions.listBudgetOccurrencesInRange(b.id, from, planningTo);
      const merged = mergeOccurrences(virtual, dbRows);
      const kind = catKind.get(b.category_id) ?? "expense";
      for (const o of merged) {
        if (kind === "income") {
          planned_income += o.planned_amount;
        } else if (kind === "expense") {
          planned_expense += o.planned_amount;
          if (isUnpaidOccurrence(o)) {
            pending_planned_expense += o.planned_amount;
          }
        }
      }
    }

    const balance_to_be_paid = pending_planned_expense;
    const balance_after_all_expenses = planned_income - planned_expense;

    return {
      period: { from, to },
      income: sums.income,
      expense: sums.expense,
      net: sums.income - sums.expense,
      planned_expense,
      planned_income,
      pending_planned_expense,
      balance_to_be_paid,
      balance_after_all_expenses,
      planned_vs_actual_variance: balance_to_be_paid,
      category_breakdown,
    };
  }

  async monthlyDashboard(projectId: string, year: number, monthIndex0: number) {
    const monthStart = startOfMonthUTC(year, monthIndex0);
    const monthEnd = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = toISODate(monthStart);
    const to = toISODate(monthEnd);
    const dash = await this.rangeDashboard(projectId, from, to);
    return {
      ...dash,
      month: { year, month: monthIndex0 + 1 },
    };
  }
}
