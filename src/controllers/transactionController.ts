import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import { createTransactionSchema, updateTransactionSchema } from "../models/schemas.js";
import { assertProjectMember } from "../lib/projectAuthz.js";
import { normalizePaymentRefs } from "../lib/normalizePayment.js";

export function transactionController(
  tx: TransactionRepository,
  categories: CategoryRepository
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
  };
}
