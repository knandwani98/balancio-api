import type { Response } from "express";
import type { AuthedFileRequest, AuthedRequest } from "../middleware/clerkAuth.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import {
  confirmImportStatementSchema,
  createTransactionSchema,
  updateTransactionSchema,
} from "../models/schemas.js";
import type { StatementImportBankId } from "../services/statementImport/types.js";
import type { ParsedStatementResult } from "../services/statementImport/types.js";
import { assertProjectMember } from "../lib/projectAuthz.js";
import { normalizePaymentRefs } from "../lib/normalizePayment.js";
import { extractPdfText } from "../services/statementImport/extractPdfText.js";
import {
  isImportableBankAccount,
  resolveStatementImportBankId,
} from "../services/statementImport/importableAccount.js";
import { parseStatementWithDetection } from "../services/statementImport/detectStatement.js";
import { parseBankStatement } from "../services/statementImport/parseStatement.js";

type ImportAccountContext = {
  bankAccountId: string;
  bankId: StatementImportBankId;
};

async function resolveImportAccount(
  userId: string,
  bankAccountIdRaw: string,
  paymentInstruments: PaymentInstrumentRepository,
  res: Response
): Promise<ImportAccountContext | null> {
  const bankAccountId = bankAccountIdRaw.trim();
  if (!bankAccountId) {
    res.status(400).json({ error: "bank_account_id is required" });
    return null;
  }

  const account = await paymentInstruments.getBankAccountForUser(userId, bankAccountId);
  if (!account) {
    res.status(400).json({ error: "Invalid bank account" });
    return null;
  }

  if (!isImportableBankAccount(account)) {
    res.status(400).json({
      error:
        "Statement import is only supported for Kotak Mahindra Bank and Bank of India accounts",
    });
    return null;
  }

  const bankId = resolveStatementImportBankId(account);
  if (!bankId) {
    res.status(400).json({
      error:
        "Statement import is only supported for Kotak Mahindra Bank and Bank of India accounts",
    });
    return null;
  }

  return { bankAccountId, bankId };
}

export function transactionController(
  tx: TransactionRepository,
  categories: CategoryRepository,
  paymentInstruments: PaymentInstrumentRepository
) {
  return {
    list: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const { from, to, type } = req.query;
      const rows = await tx.list(projectId, {
        from: typeof from === "string" ? from : undefined,
        to: typeof to === "string" ? to : undefined,
        type: type === "income" || type === "expense" ? type : undefined,
      });
      res.json(rows);
    },
    create: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const body = parsed.data;

      if (body.category_id) {
        const cat = await categories.getById(projectId, body.category_id);
        if (!cat) {
          res.status(400).json({ error: "Invalid category_id" });
          return;
        }
      }

      const pm = body.payment_method ?? "cash";
      const payment = normalizePaymentRefs(pm, {
        bank_account_id: body.bank_account_id,
        card_id: body.card_id,
        wallet_id: body.wallet_id,
      });
      const row = await tx.create({
        project_id: projectId,
        created_by_user_id: req.userId,
        user_id: req.userId,
        type: body.type,
        name: body.name,
        amount: body.amount,
        line_status: body.line_status ?? "pending",
        occurred_at: body.occurred_at,
        category_id: body.category_id ?? null,
        note: body.note ?? null,
        reference_details: body.reference_details?.trim()
          ? body.reference_details.trim()
          : null,
        budget_id: body.budget_id ?? null,
        due_date: body.due_date ?? null,
        ...payment,
      });
      res.status(201).json(row);
    },
    update: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const transactionId = String(req.params.transactionId);
      await assertProjectMember(req.userId, projectId);
      const parsed = updateTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const body = parsed.data;

      if (body.category_id) {
        const cat = await categories.getById(projectId, body.category_id);
        if (!cat) {
          res.status(400).json({ error: "Invalid category_id" });
          return;
        }
      }

      const row = await tx.update(projectId, transactionId, {
        type: body.type,
        name: body.name,
        amount: body.amount,
        line_status: body.line_status,
        payment_method: body.payment_method,
        occurred_at: body.occurred_at,
        category_id: body.category_id ?? null,
        note: body.note ?? null,
        reference_details: body.reference_details?.trim()
          ? body.reference_details.trim()
          : null,
      });
      if (!row) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      res.json(row);
    },
    remove: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const transactionId = String(req.params.transactionId);
      await assertProjectMember(req.userId, projectId);
      const ok = await tx.remove(projectId, transactionId);
      if (!ok) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      res.status(204).end();
    },
    previewImportStatement: async (req: AuthedFileRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);

      const bankAccountIdRaw =
        typeof req.body?.bank_account_id === "string" ? req.body.bank_account_id.trim() : "";

      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ error: "PDF statement file is required" });
        return;
      }

      let text: string;
      try {
        text = await extractPdfText(file.buffer);
      } catch {
        res.status(400).json({ error: "Could not read PDF file" });
        return;
      }

      if (!text.trim()) {
        res.status(400).json({ error: "PDF contains no readable text" });
        return;
      }

      let bankId: StatementImportBankId;
      let parsed: ParsedStatementResult;
      let detectionAccountDigits: string | null;

      if (bankAccountIdRaw) {
        const ctx = await resolveImportAccount(
          req.userId,
          bankAccountIdRaw,
          paymentInstruments,
          res
        );
        if (!ctx) return;
        bankId = ctx.bankId;
        try {
          parsed = parseBankStatement(bankId, text);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Failed to parse statement";
          res.status(400).json({ error: message });
          return;
        }
        detectionAccountDigits = null;
      } else {
        try {
          const auto = parseStatementWithDetection(text);
          bankId = auto.bankId;
          parsed = auto.result;
          detectionAccountDigits = auto.detection.accountNumberDigits;
        } catch (e) {
          const message = e instanceof Error ? e.message : "Failed to parse statement";
          res.status(400).json({ error: message });
          return;
        }
      }

      if (parsed.lines.length === 0) {
        res.status(400).json({ error: "No transactions found in statement" });
        return;
      }

      const lines = [...parsed.lines].sort(
        (a, b) => a.statement_order - b.statement_order
      );

      res.json({
        bank_account_id: bankAccountIdRaw || null,
        detected_bank: bankId,
        detected_account_number: detectionAccountDigits,
        lines,
        opening_balance: parsed.opening_balance,
        closing_balance: parsed.closing_balance,
      });
    },
    confirmImportStatement: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);

      const parsedBody = confirmImportStatementSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({ error: parsedBody.error.flatten() });
        return;
      }

      const {
        bank_account_id: bankAccountId,
        lines: rawLines,
        opening_balance: statementOpening,
        closing_balance: statementClosing,
      } = parsedBody.data;
      const lines = [...rawLines].sort(
        (a, b) => (a.statement_order ?? 0) - (b.statement_order ?? 0)
      );
      const ctx = await resolveImportAccount(
        req.userId,
        bankAccountId,
        paymentInstruments,
        res
      );
      if (!ctx) return;

      const payment = normalizePaymentRefs("bank", {
        bank_account_id: ctx.bankAccountId,
      });

      const rows = [];
      for (const line of lines) {
        let categoryId: string | null = line.category_id ?? null;
        if (categoryId) {
          const cat = await categories.getById(projectId, categoryId);
          if (
            !cat ||
            (cat.kind !== "neutral" && cat.kind !== line.type)
          ) {
            res.status(400).json({
              error: `Invalid category for transaction: ${line.name}`,
            });
            return;
          }
        }

        rows.push({
          project_id: projectId,
          created_by_user_id: req.userId,
          user_id: req.userId,
          type: line.type,
          name: line.name.trim(),
          amount: line.amount,
          line_status: "cleared" as const,
          occurred_at: line.occurred_at,
          category_id: categoryId,
          note: line.note?.trim() ? line.note.trim() : null,
          reference_details: line.reference_no?.trim()
            ? line.reference_no.trim()
            : null,
          statement_order: line.statement_order ?? null,
          ...payment,
        });
      }

      const imported = await tx.createMany(rows, { preserveStatementOrder: true });

      const txnNet = await tx.computeClearedTransactionNetForBankAccount(
        ctx.bankAccountId,
        projectId
      );

      let ledgerBaseline: number;
      if (statementClosing != null) {
        ledgerBaseline = statementClosing - txnNet;
      } else if (statementOpening != null) {
        ledgerBaseline = statementOpening;
      } else {
        const account = await paymentInstruments.getBankAccountForUser(
          req.userId,
          ctx.bankAccountId
        );
        ledgerBaseline =
          account?.current_balance != null
            ? account.current_balance.toNumber()
            : 0;
      }

      await paymentInstruments.setBankAccountLedgerBaseline(
        req.userId,
        ctx.bankAccountId,
        ledgerBaseline
      );

      const current_balance = await tx.computeNetBalanceForBankAccount(
        ctx.bankAccountId,
        projectId
      );

      res.status(201).json({
        imported,
        bank_account_id: ctx.bankAccountId,
        current_balance,
      });
    },
  };
}
