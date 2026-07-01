import type { BudgetRepository } from "../repositories/budgetRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import { computeOccurrences, mergeOccurrences } from "./budgetOccurrenceService.js";
import type { MergedOccurrence } from "./budgetOccurrenceService.js";
import { budgetPlanningRangeEnd, startOfMonthUTC, toISODate } from "../utils/dates.js";

function occurrencePaidAmount(o: MergedOccurrence): number {
  if (o.schedule_status !== "DONE") return 0;
  return o.actual_amount ?? o.planned_amount;
}

function budgetPlannedTotal(occurrences: readonly MergedOccurrence[]): number {
  let planned = 0;
  for (const o of occurrences) {
    planned += o.planned_amount;
  }
  return planned;
}

function budgetPaidFromOccurrences(occurrences: readonly MergedOccurrence[]): number {
  let paid = 0;
  for (const o of occurrences) {
    paid += occurrencePaidAmount(o);
  }
  return paid;
}

/** Planned minus recorded payments for occurrences in range (0 when fully paid). */
function budgetPendingBalance(
  occurrences: readonly MergedOccurrence[],
  paidFromTransactions: number
): number {
  const planned = budgetPlannedTotal(occurrences);
  if (planned <= 0) return 0;
  const paid = Math.max(budgetPaidFromOccurrences(occurrences), paidFromTransactions);
  return Math.max(0, planned - paid);
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

    const category_breakdown = Array.from(byCat.entries())
      .map(([category_id, total]) => ({
        category_id,
        name: category_id ? (catNames.get(category_id) ?? "Unknown") : "Uncategorized",
        amount: total,
      }))
      .sort((a, b) => b.amount - a.amount);

    const expense = category_breakdown.reduce((sum, row) => sum + row.amount, 0);

    const budgetList = await this.budgets.list(projectId);
    const catKind = new Map(cats.map((c) => [c.id, c.kind]));
    const planningTo = budgetPlanningRangeEnd(from, to);
    const paidByBudget = await this.transactions.sumClearedBudgetTransactionsByBudgetInRange(
      projectId,
      from,
      planningTo
    );
    let planned_expense = 0;
    let planned_income = 0;
    const pendingByBudget = new Map<string, number>();
    for (const b of budgetList) {
      const virtual = computeOccurrences(b, from, planningTo);
      const dbRows = await this.transactions.listBudgetOccurrencesInRange(b.id, from, planningTo);
      const merged = mergeOccurrences(virtual, dbRows);
      const kind = catKind.get(b.category_id) ?? "expense";
      const expenseOccurrences: MergedOccurrence[] = [];
      for (const o of merged) {
        if (kind === "income") {
          planned_income += o.planned_amount;
        } else if (kind === "expense") {
          planned_expense += o.planned_amount;
          expenseOccurrences.push(o);
        }
      }
      if (kind === "expense" && expenseOccurrences.length > 0) {
        const remaining = budgetPendingBalance(
          expenseOccurrences,
          paidByBudget.get(b.id) ?? 0
        );
        if (remaining > 0) {
          pendingByBudget.set(b.id, remaining);
        }
      }
    }

    const budgetTitles = new Map(budgetList.map((b) => [b.id, b.title]));
    const pending_planned_expense_breakdown = Array.from(pendingByBudget.entries())
      .map(([budget_id, amount]) => ({
        budget_id,
        name: budgetTitles.get(budget_id) ?? "Unknown budget",
        amount,
      }))
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const pending_planned_expense = pending_planned_expense_breakdown.reduce(
      (sum, row) => sum + row.amount,
      0
    );

    const balance_to_be_paid = pending_planned_expense;
    const balance_after_all_expenses = planned_income - planned_expense;

    return {
      period: { from, to },
      income: sums.income,
      expense,
      net: sums.income - expense,
      planned_expense,
      planned_income,
      pending_planned_expense,
      balance_to_be_paid,
      balance_after_all_expenses,
      planned_vs_actual_variance: balance_to_be_paid,
      category_breakdown,
      pending_planned_expense_breakdown,
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
