import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { budgetPaymentForTransaction, parseISODateOnly, toTransactionRow } from "../lib/prismaMappers.js";
import { toPrismaDecimal } from "../lib/money.js";
import type {
  Database,
  PaymentMethod,
  TransactionLineStatus,
  TransactionType,
} from "../types/database.js";
import type { BudgetOccurrenceRow } from "../services/budgetOccurrenceService.js";

export class TransactionRepository {
  /** Sum of cleared income − expense on a bank account (no opening baseline). */
  async computeClearedTransactionNetForBankAccount(
    bankAccountId: string,
    projectId?: string
  ): Promise<number> {
    const rows = await prisma.transaction.findMany({
      where: {
        bank_account_id: bankAccountId,
        line_status: "cleared",
        ...(projectId ? { project_id: projectId } : {}),
      },
      select: { type: true, amount: true },
    });
    return rows.reduce((balance, row) => {
      const amount = row.amount.toNumber();
      return balance + (row.type === "income" ? amount : -amount);
    }, 0);
  }

  /** Opening baseline on the account + cleared transaction net. */
  async computeNetBalanceForBankAccount(
    bankAccountId: string,
    projectId?: string
  ): Promise<number> {
    const account = await prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      select: { current_balance: true },
    });
    const baseline = account?.current_balance.toNumber() ?? 0;
    const txnNet = await this.computeClearedTransactionNetForBankAccount(
      bankAccountId,
      projectId
    );
    return baseline + txnNet;
  }

  /** Sum of cleared income − expense on a wallet (no opening baseline). */
  async computeClearedTransactionNetForWallet(
    walletId: string,
    projectId?: string
  ): Promise<number> {
    const rows = await prisma.transaction.findMany({
      where: {
        wallet_id: walletId,
        line_status: "cleared",
        ...(projectId ? { project_id: projectId } : {}),
      },
      select: { type: true, amount: true },
    });
    return rows.reduce((balance, row) => {
      const amount = row.amount.toNumber();
      return balance + (row.type === "income" ? amount : -amount);
    }, 0);
  }

  /** Opening baseline on the wallet + cleared transaction net. */
  async computeNetBalanceForWallet(walletId: string, projectId?: string): Promise<number> {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      select: { current_balance: true },
    });
    const baseline = wallet?.current_balance.toNumber() ?? 0;
    const txnNet = await this.computeClearedTransactionNetForWallet(walletId, projectId);
    return baseline + txnNet;
  }

  async list(
    projectId: string,
    opts: { from?: string; to?: string; type?: TransactionType }
  ): Promise<Database["public"]["Tables"]["transaction"]["Row"][]> {
    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
        OR: [{ budget_id: null }, { line_status: "cleared" }],
        ...(opts.from || opts.to
          ? {
              occurred_at: {
                ...(opts.from ? { gte: parseISODateOnly(opts.from) } : {}),
                ...(opts.to ? { lte: parseISODateOnly(opts.to) } : {}),
              },
            }
          : {}),
        ...(opts.type ? { type: opts.type } : {}),
      },
      orderBy: [
        { occurred_at: "desc" },
        { statement_order: { sort: "desc", nulls: "last" } },
        { created_at: "desc" },
      ],
    });
    return rows.map(toTransactionRow);
  }

  async listForBudget(
    projectId: string,
    budgetId: string
  ): Promise<Database["public"]["Tables"]["transaction"]["Row"][]> {
    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
        budget_id: budgetId,
        line_status: "cleared",
      },
      orderBy: [
        { occurred_at: "desc" },
        { statement_order: { sort: "desc", nulls: "last" } },
        { created_at: "desc" },
      ],
    });
    return rows.map(toTransactionRow);
  }

  private mapBudgetOccurrenceRows(
    rows: Awaited<ReturnType<typeof prisma.transaction.findMany>>
  ): BudgetOccurrenceRow[] {
    return rows
      .filter((r): r is typeof r & { budget_id: string; due_date: Date } =>
        Boolean(r.budget_id && r.due_date)
      )
      .map((r) => {
        const row = toTransactionRow(r);
        return {
          ...row,
          budget_id: r.budget_id!,
          due_date: row.due_date!,
        };
      });
  }

  async listBudgetOccurrencesInRange(
    budgetId: string,
    fromDue: string,
    toDue: string
  ): Promise<BudgetOccurrenceRow[]> {
    const rows = await prisma.transaction.findMany({
      where: {
        budget_id: budgetId,
        line_status: "cleared",
        due_date: {
          gte: parseISODateOnly(fromDue),
          lte: parseISODateOnly(toDue),
        },
      },
      orderBy: { due_date: "asc" },
    });
    return this.mapBudgetOccurrenceRows(rows);
  }

  async listBudgetOccurrencesPaginated(
    budgetId: string,
    opts: { from?: string; to?: string; offset: number; limit: number }
  ): Promise<{ rows: BudgetOccurrenceRow[]; total: number }> {
    const where: Prisma.TransactionWhereInput = {
      budget_id: budgetId,
      due_date: {
        not: null,
        ...(opts.from ? { gte: parseISODateOnly(opts.from) } : {}),
        ...(opts.to ? { lte: parseISODateOnly(opts.to) } : {}),
      },
    };

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { due_date: "desc" },
        skip: opts.offset,
        take: opts.limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { rows: this.mapBudgetOccurrenceRows(rows), total };
  }

  async getBudgetOccurrenceByBudgetAndDueDate(budgetId: string, dueDate: string) {
    const row = await prisma.transaction.findUnique({
      where: {
        budget_id_due_date: {
          budget_id: budgetId,
          due_date: parseISODateOnly(dueDate),
        },
      },
    });
    if (!row?.budget_id || !row.due_date) return null;
    const mapped = toTransactionRow(row);
    return {
      ...mapped,
      budget_id: row.budget_id,
      due_date: mapped.due_date!,
    } satisfies BudgetOccurrenceRow;
  }

  async deleteBudgetOccurrence(budgetId: string, dueDate: string): Promise<void> {
    await prisma.transaction.deleteMany({
      where: {
        budget_id: budgetId,
        due_date: parseISODateOnly(dueDate),
        line_status: "pending",
      },
    });
  }

  async upsertBudgetOccurrence(
    budget: Database["public"]["Tables"]["budget"]["Row"],
    projectId: string,
    userId: string,
    transactionType: TransactionType,
    row: {
      due_date: string;
      planned_amount?: number | null;
      actual_amount?: number | null;
      note?: string | null;
      line_status?: TransactionLineStatus;
    }
  ): Promise<BudgetOccurrenceRow> {
    const existing = await this.getBudgetOccurrenceByBudgetAndDueDate(budget.id, row.due_date);
    const cleared =
      row.line_status === "cleared" ||
      (row.actual_amount != null && row.actual_amount !== undefined);
    if (!cleared) {
      throw new Error("Budget occurrence transactions are only created when payment is recorded");
    }

    const planned =
      row.planned_amount !== undefined && row.planned_amount !== null
        ? row.planned_amount
        : (existing?.amount ?? budget.default_planned_amount);
    const actual =
      row.actual_amount != null ? row.actual_amount : (existing?.amount ?? planned);
    const amount = actual ?? planned;
    const lineStatus: TransactionLineStatus = "cleared";
    const dueDate = parseISODateOnly(row.due_date);
    const note = row.note !== undefined ? row.note : (existing?.note ?? null);
    const payment = budgetPaymentForTransaction(budget);

    const upserted = await prisma.transaction.upsert({
      where: {
        budget_id_due_date: {
          budget_id: budget.id,
          due_date: dueDate,
        },
      },
      create: {
        project_id: projectId,
        created_by_user_id: userId,
        user_id: userId,
        type: transactionType,
        name: budget.title,
        amount: toPrismaDecimal(amount),
        line_status: lineStatus,
        payment_method: payment.payment_method,
        occurred_at: dueDate,
        category_id: budget.category_id,
        note,
        budget_id: budget.id,
        due_date: dueDate,
        bank_account_id: payment.bank_account_id,
        card_id: payment.card_id,
        wallet_id: payment.wallet_id,
      },
      update: {
        due_date: dueDate,
        amount: toPrismaDecimal(amount),
        line_status: lineStatus,
        note,
        occurred_at: dueDate,
      },
    });

    const mapped = toTransactionRow(upserted);
    return {
      ...mapped,
      budget_id: upserted.budget_id!,
      due_date: mapped.due_date!,
    };
  }

  async create(row: Database["public"]["Tables"]["transaction"]["Insert"]) {
    const data: Prisma.TransactionUncheckedCreateInput = {
      project_id: row.project_id,
      created_by_user_id: row.created_by_user_id,
      user_id: row.user_id,
      type: row.type,
      name: row.name,
      amount: toPrismaDecimal(row.amount),
      line_status: row.line_status ?? "pending",
      payment_method: row.payment_method ?? "cash",
      occurred_at: parseISODateOnly(row.occurred_at),
      category_id: row.category_id ?? null,
      note: row.note ?? null,
      reference_details: row.reference_details ?? null,
      statement_order: row.statement_order ?? null,
      budget_id: row.budget_id ?? null,
      due_date: row.due_date ? parseISODateOnly(row.due_date) : null,
      bank_account_id: row.bank_account_id ?? null,
      card_id: row.card_id ?? null,
      wallet_id: row.wallet_id ?? null,
    };

    if (!row.budget_id) {
      const created = await prisma.transaction.create({ data });
      return toTransactionRow(created);
    }

    const created = await prisma.transaction.create({ data });
    return toTransactionRow(created);
  }

  async createMany(
    rows: Database["public"]["Tables"]["transaction"]["Insert"][],
    options?: { preserveStatementOrder?: boolean }
  ): Promise<number> {
    if (rows.length === 0) return 0;

    const baseCreatedAt = Date.now();

    await prisma.$transaction(async (trx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        await trx.transaction.create({
          data: {
            project_id: row.project_id,
            created_by_user_id: row.created_by_user_id,
            user_id: row.user_id,
            type: row.type,
            name: row.name,
            amount: toPrismaDecimal(row.amount),
            line_status: row.line_status ?? "cleared",
            payment_method: row.payment_method ?? "bank",
            occurred_at: parseISODateOnly(row.occurred_at),
            category_id: row.category_id ?? null,
            note: row.note ?? null,
            reference_details: row.reference_details ?? null,
            statement_order: row.statement_order ?? null,
            budget_id: null,
            due_date: null,
            bank_account_id: row.bank_account_id ?? null,
            card_id: null,
            wallet_id: null,
            ...(options?.preserveStatementOrder
              ? {
                  created_at: new Date(
                    baseCreatedAt + (row.statement_order ?? i) * 1000
                  ),
                }
              : {}),
          },
        });
      }
    });

    return rows.length;
  }

  async update(
    projectId: string,
    id: string,
    body: {
      type: TransactionType;
      name: string;
      amount: number;
      line_status?: TransactionLineStatus;
      payment_method?: PaymentMethod;
      occurred_at: string;
      category_id: string | null;
      note: string | null;
      reference_details?: string | null;
    }
  ) {
    const existing = await prisma.transaction.findFirst({
      where: { id, project_id: projectId },
    });
    if (!existing) return null;

    const nextStatus = body.line_status ?? existing.line_status;

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        type: body.type,
        name: body.name,
        amount: toPrismaDecimal(body.amount),
        line_status: nextStatus,
        payment_method: body.payment_method ?? existing.payment_method,
        occurred_at: parseISODateOnly(body.occurred_at),
        category_id: body.category_id,
        note: body.note,
        reference_details: body.reference_details ?? null,
      },
    });

    return toTransactionRow(updated);
  }

  async remove(projectId: string, id: string): Promise<boolean> {
    const result = await prisma.transaction.deleteMany({
      where: { id, project_id: projectId },
    });
    return result.count > 0;
  }

  async sumByTypeInMonth(projectId: string, year: number, monthIndex0: number) {
    const start = new Date(Date.UTC(year, monthIndex0, 1));
    const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    return this.sumByTypeInRange(projectId, from, to);
  }

  async sumByTypeInRange(projectId: string, from: string, to: string) {
    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
        line_status: "cleared",
        occurred_at: {
          gte: parseISODateOnly(from),
          lte: parseISODateOnly(to),
        },
      },
      select: { type: true, amount: true },
    });

    let income = 0;
    let expense = 0;
    for (const r of rows) {
      const n = r.amount.toNumber();
      if (r.type === "income") income += n;
      else expense += n;
    }
    return { income: income, expense: expense };
  }

  async sumExpenseByCategoryInMonth(projectId: string, year: number, monthIndex0: number) {
    const start = new Date(Date.UTC(year, monthIndex0, 1));
    const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    return this.sumExpenseByCategoryInRange(projectId, from, to);
  }

  async sumExpenseByCategoryInRange(projectId: string, from: string, to: string) {
    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
        type: "expense",
        line_status: "cleared",
        occurred_at: {
          gte: parseISODateOnly(from),
          lte: parseISODateOnly(to),
        },
      },
      select: { category_id: true, amount: true },
    });

    const map = new Map<string | null, number>();
    for (const r of rows) {
      const k = r.category_id;
      map.set(k, (map.get(k) ?? 0) + r.amount.toNumber());
    }
    return map;
  }
}
