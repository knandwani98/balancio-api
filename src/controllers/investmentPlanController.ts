import type { BudgetRecurrence } from "@prisma/client";
import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { InvestmentPlanRepository } from "../repositories/investmentPlanRepository.js";
import {
  createInvestmentPlanSchema,
  createPlanHoldingSchema,
  createPlanHoldingTransactionSchema,
  createPlanPointSchema,
  listPlanHoldingsQuerySchema,
  listPlanOrdersQuerySchema,
  patchPlanHoldingCurrentNavSchema,
  updateInvestmentPlanSchema,
  updatePlanHoldingSchema,
  updatePlanPointSchema,
} from "../models/schemas.js";
import { assertProjectMember } from "../lib/projectAuthz.js";
import { parseISODateOnly } from "../lib/prismaMappers.js";
import { toPrismaDecimal } from "../lib/money.js";
import { toPlanDetailRow, toPlanListSummaryRow } from "../lib/investmentPlanMappers.js";
import { normalizePlanHoldingAsset } from "../lib/planHoldingAsset.js";
import { normalizePlanHoldingBroker } from "../lib/planHoldingBroker.js";
import { toPlanHoldingRow } from "../lib/planHoldingMappers.js";
import {
  toPlanHoldingTransactionRow,
  toPlanOrderTransactionRow,
} from "../lib/planHoldingTransactionMappers.js";
import {
  normalizeAndValidateFunds,
  type PlanFundInput,
} from "../services/planAllocationMath.js";
import {
  assertEffectiveFromAfterPrior,
  assertEffectiveFromBetweenSiblings,
  assertEffectiveFromInPlan,
  healEffectiveToAfterDelete,
  initialPointEffectiveFrom,
  parseEffectiveFrom,
} from "../services/planTimelineService.js";
import {
  fundNameToInitials,
  randomBadgeColor,
} from "../services/fundBadgeUtils.js";

function mapFundInputs(
  funds: {
    name: string;
    input_mode: "percentage" | "amount";
    value: number;
    frequency?: BudgetRecurrence;
    schedule_day?: number | null;
  }[]
): PlanFundInput[] {
  return funds.map((f) => ({
    name: f.name,
    input_mode: f.input_mode,
    value: f.value,
    frequency: f.frequency ?? "monthly",
    schedule_day: f.schedule_day ?? null,
  }));
}

export function investmentPlanController(plans: InvestmentPlanRepository) {
  return {
    list: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const rows = await plans.list(projectId);
      res.json(
        rows.map((p) =>
          toPlanListSummaryRow({
            ...p,
            point_count: p._count.points,
          })
        )
      );
    },

    get: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      await assertProjectMember(req.userId, projectId);
      const plan = await plans.getById(projectId, planId);
      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.json(toPlanDetailRow(plan));
    },

    create: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createInvestmentPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;
      const periodAmount = d.period_amount;
      const startDate = parseISODateOnly(d.start_date);
      const endDate = d.end_date ? parseISODateOnly(d.end_date) : null;
      if (endDate && endDate.getTime() < startDate.getTime()) {
        res.status(400).json({ error: "End date must be on or after start date" });
        return;
      }

      const existingByName = await plans.getByName(projectId, d.name);
      if (existingByName?.is_tracked) {
        res.status(409).json({ error: "This category is already tracked" });
        return;
      }
      if (existingByName && !existingByName.is_tracked) {
        const retracked = await plans.retrackPlan(projectId, existingByName.id);
        if (!retracked) {
          res.status(404).json({ error: "Plan not found" });
          return;
        }
        res.json(toPlanDetailRow(retracked));
        return;
      }

      const planFields = {
        name: d.name,
        start_date: startDate,
        end_date: endDate,
        period_amount: toPrismaDecimal(periodAmount),
      };

      if (!d.initial_point?.funds?.length) {
        const plan = await plans.create(projectId, req.userId, planFields);
        res.status(201).json(toPlanDetailRow(plan));
        return;
      }

      if (periodAmount <= 0) {
        res.status(400).json({ error: "period_amount must be greater than zero when adding funds" });
        return;
      }

      let normalized;
      try {
        normalized = normalizeAndValidateFunds(periodAmount, mapFundInputs(d.initial_point.funds));
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Invalid funds" });
        return;
      }

      let effectiveFrom: Date;
      try {
        effectiveFrom = initialPointEffectiveFrom(
          startDate,
          d.initial_point.effective_from
            ? parseEffectiveFrom(d.initial_point.effective_from)
            : undefined
        );
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Invalid date" });
        return;
      }
      if (endDate && effectiveFrom.getTime() > endDate.getTime()) {
        res.status(400).json({ error: "Initial point must be within plan dates" });
        return;
      }

      const plan = await plans.create(projectId, req.userId, planFields, {
        effective_from: effectiveFrom,
        period_amount: toPrismaDecimal(periodAmount),
        funds: normalized,
      });
      res.status(201).json(toPlanDetailRow(plan));
    },

    update: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      await assertProjectMember(req.userId, projectId);
      const parsed = updateInvestmentPlanSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;
      const existing = await plans.getById(projectId, planId);
      if (!existing) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      const startDate = d.start_date ? parseISODateOnly(d.start_date) : existing.start_date;
      const endDate =
        d.end_date !== undefined
          ? d.end_date
            ? parseISODateOnly(d.end_date)
            : null
          : existing.end_date;
      if (endDate && endDate.getTime() < startDate.getTime()) {
        res.status(400).json({ error: "End date must be on or after start date" });
        return;
      }

      const updated = await plans.updatePlan(projectId, planId, {
        ...(d.name !== undefined && { name: d.name }),
        ...(d.start_date !== undefined && { start_date: startDate }),
        ...(d.end_date !== undefined && { end_date: endDate }),
        ...(d.period_amount !== undefined && {
          period_amount: toPrismaDecimal(d.period_amount),
        }),
      });
      if (!updated) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.json(toPlanDetailRow(updated));
    },

    remove: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      await assertProjectMember(req.userId, projectId);
      const untracked = await plans.untrackPlan(projectId, planId);
      if (!untracked) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.status(204).send();
    },

    addPoint: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createPlanPointSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const plan = await plans.getById(projectId, planId);
      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      const effectiveFrom = parseEffectiveFrom(parsed.data.effective_from);
      try {
        assertEffectiveFromInPlan(plan, effectiveFrom);
        assertEffectiveFromAfterPrior(plan.points, effectiveFrom);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Invalid date" });
        return;
      }

      const pointTotal = parsed.data.period_amount;
      let normalized;
      try {
        normalized = normalizeAndValidateFunds(
          pointTotal,
          mapFundInputs(parsed.data.funds)
        );
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Invalid funds" });
        return;
      }

      const updated = await plans.addPoint(
        plan,
        effectiveFrom,
        toPrismaDecimal(pointTotal),
        normalized
      );
      res.status(201).json(toPlanDetailRow(updated));
    },

    updatePoint: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const pointId = String(req.params.pointId);
      await assertProjectMember(req.userId, projectId);
      const parsed = updatePlanPointSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const plan = await plans.getById(projectId, planId);
      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      const point = plan.points.find((p) => p.id === pointId);
      if (!point) {
        res.status(404).json({ error: "Timeline point not found" });
        return;
      }

      const patch: {
        effective_from?: Date;
        period_amount?: ReturnType<typeof toPrismaDecimal>;
        funds?: ReturnType<typeof normalizeAndValidateFunds>;
      } = {};
      if (parsed.data.effective_from) {
        const effectiveFrom = parseEffectiveFrom(parsed.data.effective_from);
        try {
          assertEffectiveFromInPlan(plan, effectiveFrom);
          const sorted = [...plan.points].sort(
            (a, b) => a.effective_from.getTime() - b.effective_from.getTime()
          );
          assertEffectiveFromBetweenSiblings(sorted, pointId, effectiveFrom);
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : "Invalid date" });
          return;
        }
        patch.effective_from = effectiveFrom;
      }
      if (parsed.data.period_amount !== undefined) {
        patch.period_amount = toPrismaDecimal(parsed.data.period_amount);
      }
      if (parsed.data.funds) {
        const pointTotal =
          parsed.data.period_amount ?? point.period_amount.toNumber();
        try {
          patch.funds = normalizeAndValidateFunds(
            pointTotal,
            mapFundInputs(parsed.data.funds)
          );
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : "Invalid funds" });
          return;
        }
      }

      const updated = await plans.updatePoint(projectId, planId, pointId, patch);
      if (!updated) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.json(toPlanDetailRow(updated));
    },

    removePoint: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const pointId = String(req.params.pointId);
      await assertProjectMember(req.userId, projectId);

      const plan = await plans.getById(projectId, planId);
      if (!plan) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      let heal: ReturnType<typeof healEffectiveToAfterDelete> = null;
      try {
        heal = healEffectiveToAfterDelete(plan.points, pointId, plan.end_date);
        const updated = await plans.deletePoint(projectId, planId, pointId, heal);
        if (!updated) {
          res.status(404).json({ error: "Plan not found" });
          return;
        }
        res.json(toPlanDetailRow(updated));
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Delete failed" });
      }
    },

    listHoldings: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      await assertProjectMember(req.userId, projectId);

      const parsed = listPlanHoldingsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const fundTypes = parsed.data.fund_type
        ? Array.isArray(parsed.data.fund_type)
          ? parsed.data.fund_type
          : [parsed.data.fund_type]
        : undefined;

      const rows = await plans.listHoldings(projectId, planId, {
        sort: parsed.data.sort,
        fundTypes,
      });
      if (!rows) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.json(rows.map(toPlanHoldingRow));
    },

    getHolding: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      await assertProjectMember(req.userId, projectId);

      const row = await plans.getHolding(projectId, planId, holdingId);
      if (!row) {
        res.status(404).json({ error: "Holding not found" });
        return;
      }
      res.json(toPlanHoldingRow(row));
    },

    createHolding: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      await assertProjectMember(req.userId, projectId);

      const parsed = createPlanHoldingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const trimmedName = parsed.data.name.trim();
      const badge = fundNameToInitials(trimmedName);
      if (!badge) {
        res.status(400).json({ error: "Enter a valid fund name to generate an icon" });
        return;
      }

      const brokerFields = normalizePlanHoldingBroker(parsed.data);
      const assetFields = normalizePlanHoldingAsset({
        asset_type: parsed.data.asset_type,
        asset_metal: parsed.data.asset_metal,
        asset_other_name: parsed.data.asset_other_name,
      });

      const row = await plans.createHolding(projectId, planId, {
        name: trimmedName,
        badge,
        badge_class_name: parsed.data.badge_class_name ?? randomBadgeColor(),
        fund_type: parsed.data.fund_type ?? "index",
        asset_type: parsed.data.asset_type ?? "equity",
        asset_metal: assetFields.asset_metal,
        asset_other_name: assetFields.asset_other_name,
        broker: brokerFields.broker,
        broker_name: brokerFields.broker_name,
      });
      if (!row) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.status(201).json(toPlanHoldingRow(row));
    },

    updateHolding: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      await assertProjectMember(req.userId, projectId);

      const parsed = updatePlanHoldingSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const trimmedName = parsed.data.name.trim();
      const badge = fundNameToInitials(trimmedName);
      if (!badge) {
        res.status(400).json({ error: "Enter a valid fund name to generate an icon" });
        return;
      }

      const brokerFields = normalizePlanHoldingBroker(parsed.data);
      const assetFields = normalizePlanHoldingAsset({
        asset_type: parsed.data.asset_type,
        asset_metal: parsed.data.asset_metal,
        asset_other_name: parsed.data.asset_other_name,
      });

      const row = await plans.updateHolding(projectId, planId, holdingId, {
        name: trimmedName,
        badge,
        fund_type: parsed.data.fund_type,
        asset_type: parsed.data.asset_type,
        asset_metal: assetFields.asset_metal,
        asset_other_name: assetFields.asset_other_name,
        broker: brokerFields.broker,
        broker_name: brokerFields.broker_name,
      });
      if (!row) {
        res.status(404).json({ error: "Holding not found" });
        return;
      }
      res.json(toPlanHoldingRow(row));
    },

    patchHoldingCurrentNav: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      await assertProjectMember(req.userId, projectId);

      const parsed = patchPlanHoldingCurrentNavSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const row = await plans.patchHoldingCurrentNav(
        projectId,
        planId,
        holdingId,
        parsed.data.nav
      );
      if (!row) {
        res.status(404).json({ error: "Holding not found" });
        return;
      }
      res.json(toPlanHoldingRow(row));
    },

    deleteHolding: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      await assertProjectMember(req.userId, projectId);

      const deleted = await plans.deleteHolding(projectId, planId, holdingId);
      if (!deleted) {
        res.status(404).json({ error: "Holding not found" });
        return;
      }
      res.status(204).send();
    },

    listPlanTransactions: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      await assertProjectMember(req.userId, projectId);

      const parsed = listPlanOrdersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const rows = await plans.listPlanTransactions(projectId, planId, {
        sort: parsed.data.sort,
      });
      if (!rows) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }
      res.json(rows.map(toPlanOrderTransactionRow));
    },

    listHoldingTransactions: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      await assertProjectMember(req.userId, projectId);

      const rows = await plans.listHoldingTransactions(projectId, planId, holdingId);
      if (!rows) {
        res.status(404).json({ error: "Holding not found" });
        return;
      }
      res.json(rows.map(toPlanHoldingTransactionRow));
    },

    createHoldingTransaction: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      await assertProjectMember(req.userId, projectId);

      const parsed = createPlanHoldingTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const row = await plans.createHoldingTransaction(projectId, planId, holdingId, {
        txn_date: parseISODateOnly(parsed.data.txn_date),
        nav: parsed.data.nav,
        units: parsed.data.units,
        amount: parsed.data.amount,
        invested: parsed.data.invested,
      });
      if (!row) {
        res.status(404).json({ error: "Holding not found" });
        return;
      }
      res.status(201).json(toPlanHoldingTransactionRow(row));
    },

    updateHoldingTransaction: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      const transactionId = String(req.params.transactionId);
      await assertProjectMember(req.userId, projectId);

      const parsed = createPlanHoldingTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const row = await plans.updateHoldingTransaction(
        projectId,
        planId,
        holdingId,
        transactionId,
        {
          txn_date: parseISODateOnly(parsed.data.txn_date),
          nav: parsed.data.nav,
          units: parsed.data.units,
          amount: parsed.data.amount,
          invested: parsed.data.invested,
        }
      );
      if (!row) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      res.json(toPlanHoldingTransactionRow(row));
    },

    deleteHoldingTransaction: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const planId = String(req.params.planId);
      const holdingId = String(req.params.holdingId);
      const transactionId = String(req.params.transactionId);
      await assertProjectMember(req.userId, projectId);

      const deleted = await plans.deleteHoldingTransaction(
        projectId,
        planId,
        holdingId,
        transactionId
      );
      if (!deleted) {
        res.status(404).json({ error: "Transaction not found" });
        return;
      }
      res.status(204).send();
    },
  };
}
