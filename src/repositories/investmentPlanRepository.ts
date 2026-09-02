import type { PlanFundInputMode, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { planNamesMatchSlug } from "../lib/investmentPlanSlug.js";
import type { NormalizedPlanFund } from "../services/planAllocationMath.js";
import { toPrismaPercentage } from "../services/planAllocationMath.js";
import { computeTimelineEffectiveToChain } from "../services/planTimelineService.js";

const fundCreateFields = (f: NormalizedPlanFund, i: number) => ({
  name: f.name,
  percentage: toPrismaPercentage(f.percentage),
  input_mode: f.input_mode,
  frequency: f.frequency,
  schedule_day: f.schedule_day,
  sort_order: i,
});

const pointInclude = {
  funds: { orderBy: { sort_order: "asc" as const } },
} as const;

const planInclude = {
  points: {
    include: pointInclude,
    orderBy: { effective_from: "asc" as const },
  },
  holdings: {
    select: {
      current_value: true,
      invested: true,
    },
  },
} as const;

export type PlanWithPoints = Prisma.InvestmentPlanGetPayload<{ include: typeof planInclude }>;

export type PlanListItem = Awaited<ReturnType<InvestmentPlanRepository["list"]>>[number];

/** Treat leftover dust from round-trips as a closed position. */
const OPEN_HOLDING_UNITS_EPSILON = 1e-8;

function remainingUnitsMap(
  grouped: { holding_id: string; _sum: { units: Prisma.Decimal | null } }[]
) {
  return new Map(
    grouped.map((row) => [row.holding_id, row._sum.units?.toNumber() ?? 0] as const)
  );
}

/** Open = remaining units, or no ledger yet (newly added / imported without orders). */
function isOpenHolding(holdingId: string, unitsByHolding: Map<string, number>) {
  if (!unitsByHolding.has(holdingId)) return true;
  return unitsByHolding.get(holdingId)! > OPEN_HOLDING_UNITS_EPSILON;
}

function sortHoldings<T extends { name: string; invested: { toNumber(): number }; current_value: { toNumber(): number } }>(
  rows: T[],
  sort: string
) {
  const copy = [...rows];
  if (sort === "invested") {
    return copy.sort((a, b) => b.invested.toNumber() - a.invested.toNumber());
  }
  if (sort === "current") {
    return copy.sort((a, b) => b.current_value.toNumber() - a.current_value.toNumber());
  }
  if (sort === "pnl" || sort === "pnl_pct") {
    return copy.sort((a, b) => {
      const investedA = a.invested.toNumber();
      const investedB = b.invested.toNumber();
      const pnlA = a.current_value.toNumber() - investedA;
      const pnlB = b.current_value.toNumber() - investedB;
      if (sort === "pnl") return pnlB - pnlA;
      const pctA = investedA > 0 ? pnlA / investedA : 0;
      const pctB = investedB > 0 ? pnlB / investedB : 0;
      return pctB - pctA;
    });
  }
  return copy.sort((a, b) => a.name.localeCompare(b.name));
}

export class InvestmentPlanRepository {
  async list(projectId: string) {
    return prisma.investmentPlan.findMany({
      where: { project_id: projectId, is_tracked: true },
      orderBy: { created_at: "desc" },
      include: {
        points: {
          orderBy: { effective_from: "desc" as const },
          take: 1,
          select: { period_amount: true },
        },
        holdings: {
          select: {
            current_value: true,
            invested: true,
          },
        },
        _count: { select: { points: true } },
      },
    });
  }

  async getById(projectId: string, planId: string): Promise<PlanWithPoints | null> {
    return prisma.investmentPlan.findFirst({
      where: { id: planId, project_id: projectId, is_tracked: true },
      include: planInclude,
    });
  }

  async getByName(projectId: string, name: string) {
    return prisma.investmentPlan.findFirst({
      where: {
        project_id: projectId,
        name: { equals: name, mode: "insensitive" },
      },
    });
  }

  async create(
    projectId: string,
    createdByUserId: string,
    plan: {
      name: string;
      start_date: Date;
      end_date: Date | null;
      period_amount: Prisma.Decimal;
    },
    initialPoint?: {
      effective_from: Date;
      period_amount: Prisma.Decimal;
      funds: NormalizedPlanFund[];
    }
  ): Promise<PlanWithPoints> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.investmentPlan.create({
        data: {
          project_id: projectId,
          created_by_user_id: createdByUserId,
          name: plan.name,
          start_date: plan.start_date,
          end_date: plan.end_date,
          period_amount: plan.period_amount,
          ...(initialPoint && {
            points: {
              create: {
                effective_from: initialPoint.effective_from,
                effective_to: plan.end_date,
                period_amount: initialPoint.period_amount,
                funds: {
                  create: initialPoint.funds.map(fundCreateFields),
                },
              },
            },
          }),
        },
        include: planInclude,
      });
      return created;
    });
  }

  async updatePlan(
    projectId: string,
    planId: string,
    patch: {
      name?: string;
      start_date?: Date;
      end_date?: Date | null;
      period_amount?: Prisma.Decimal;
    }
  ): Promise<PlanWithPoints | null> {
    const existing = await this.getById(projectId, planId);
    if (!existing) return null;

    await prisma.investmentPlan.updateMany({
      where: { id: planId, project_id: projectId },
      data: patch,
    });

    if (patch.end_date !== undefined) {
      await prisma.$transaction(async (tx) => {
        await this.rechainTimelinePointsInTx(tx, planId, patch.end_date ?? null);
      });
    }

    if (patch.period_amount !== undefined) {
      const latest = await prisma.planTimelinePoint.findFirst({
        where: { plan_id: planId },
        orderBy: { effective_from: "desc" },
      });
      if (latest) {
        await prisma.planTimelinePoint.update({
          where: { id: latest.id },
          data: { period_amount: patch.period_amount },
        });
      }
    }

    return this.getById(projectId, planId);
  }

  async deletePlan(projectId: string, planId: string): Promise<void> {
    await prisma.investmentPlan.deleteMany({
      where: { id: planId, project_id: projectId },
    });
  }

  async untrackPlan(projectId: string, planId: string): Promise<boolean> {
    const result = await prisma.investmentPlan.updateMany({
      where: { id: planId, project_id: projectId, is_tracked: true },
      data: { is_tracked: false },
    });
    return result.count > 0;
  }

  async retrackPlan(projectId: string, planId: string): Promise<PlanWithPoints | null> {
    const result = await prisma.investmentPlan.updateMany({
      where: { id: planId, project_id: projectId, is_tracked: false },
      data: { is_tracked: true },
    });
    if (result.count === 0) return null;
    return this.getById(projectId, planId);
  }

  async addPoint(
    plan: PlanWithPoints,
    effectiveFrom: Date,
    periodAmount: Prisma.Decimal,
    funds: NormalizedPlanFund[]
  ): Promise<PlanWithPoints> {
    const planId = plan.id;

    await prisma.$transaction(async (tx) => {
      await tx.planTimelinePoint.create({
        data: {
          plan_id: planId,
          effective_from: effectiveFrom,
          effective_to: plan.end_date,
          period_amount: periodAmount,
          funds: {
            create: funds.map(fundCreateFields),
          },
        },
      });
      await this.rechainTimelinePointsInTx(tx, planId, plan.end_date);
    });

    let result = (await this.getById(plan.project_id, planId))!;
    const latest = [...result.points].sort(
      (a, b) => b.effective_from.getTime() - a.effective_from.getTime()
    )[0];
    if (latest) {
      await prisma.investmentPlan.update({
        where: { id: planId },
        data: { period_amount: latest.period_amount },
      });
      result = (await this.getById(plan.project_id, planId))!;
    }
    return result;
  }

  async updatePoint(
    projectId: string,
    planId: string,
    pointId: string,
    patch: {
      effective_from?: Date;
      period_amount?: Prisma.Decimal;
      funds?: NormalizedPlanFund[];
    }
  ): Promise<PlanWithPoints | null> {
    const plan = await this.getById(projectId, planId);
    if (!plan) return null;
    const point = plan.points.find((p) => p.id === pointId);
    if (!point) return null;

    await prisma.$transaction(async (tx) => {
      const pointData: {
        effective_from?: Date;
        period_amount?: Prisma.Decimal;
      } = {};
      if (patch.effective_from) pointData.effective_from = patch.effective_from;
      if (patch.period_amount) pointData.period_amount = patch.period_amount;
      if (Object.keys(pointData).length > 0) {
        await tx.planTimelinePoint.update({
          where: { id: pointId },
          data: pointData,
        });
      }
      if (patch.funds) {
        await tx.planFund.deleteMany({ where: { point_id: pointId } });
        await tx.planFund.createMany({
          data: patch.funds.map((f, i) => ({
            point_id: pointId,
            ...fundCreateFields(f, i),
          })),
        });
      }
      if (patch.effective_from) {
        await this.rechainTimelinePointsInTx(tx, planId, plan.end_date);
      }
    });

    let result = await this.getById(projectId, planId);
    if (!result) return null;

    const updatedPoint = result.points.find((p) => p.id === pointId);
    const latest = [...result.points].sort(
      (a, b) => b.effective_from.getTime() - a.effective_from.getTime()
    )[0];
    if (updatedPoint && latest?.id === pointId && patch.period_amount) {
      await prisma.investmentPlan.update({
        where: { id: planId },
        data: { period_amount: patch.period_amount },
      });
      result = await this.getById(projectId, planId);
    }

    return result;
  }

  async deletePoint(
    projectId: string,
    planId: string,
    pointId: string,
    heal: { pointId: string; effective_to: Date | null } | null
  ): Promise<PlanWithPoints | null> {
    const plan = await this.getById(projectId, planId);
    if (!plan) return null;
    if (plan.points.length <= 1) {
      throw new Error("Cannot delete the only timeline point");
    }

    await prisma.$transaction(async (tx) => {
      await tx.planTimelinePoint.delete({ where: { id: pointId } });
      if (heal) {
        await tx.planTimelinePoint.update({
          where: { id: heal.pointId },
          data: { effective_to: heal.effective_to },
        });
      }
    });

    return this.getById(projectId, planId);
  }

  private async rechainTimelinePointsInTx(
    tx: Prisma.TransactionClient,
    planId: string,
    planEnd: Date | null
  ): Promise<void> {
    const points = await tx.planTimelinePoint.findMany({
      where: { plan_id: planId },
      orderBy: { effective_from: "asc" },
      select: { id: true, effective_from: true, effective_to: true },
    });
    const chain = computeTimelineEffectiveToChain(points, planEnd);
    for (const point of points) {
      const nextTo = chain.get(point.id) ?? null;
      const prevTo = point.effective_to;
      const same =
        (prevTo === null && nextTo === null) ||
        (prevTo !== null &&
          nextTo !== null &&
          prevTo.getTime() === nextTo.getTime());
      if (!same) {
        await tx.planTimelinePoint.update({
          where: { id: point.id },
          data: { effective_to: nextTo },
        });
      }
    }
  }

  async listHoldings(
    projectId: string,
    planId: string,
    options?: {
      sort?: string;
      fundTypes?: string[];
      includeClosed?: boolean;
    }
  ) {
    const plan = await prisma.investmentPlan.findFirst({
      where: { id: planId, project_id: projectId },
      select: { id: true },
    });
    if (!plan) return null;

    const where = {
      plan_id: planId,
      ...(options?.fundTypes?.length
        ? { fund_type: { in: options.fundTypes } }
        : {}),
    };

    const rows = await prisma.planHolding.findMany({ where });
    if (options?.includeClosed) {
      return sortHoldings(rows, options?.sort ?? "default");
    }

    const unitSums = await prisma.planHoldingTransaction.groupBy({
      by: ["holding_id"],
      where: { holding: { plan_id: planId } },
      _sum: { units: true },
    });
    const unitsByHolding = remainingUnitsMap(unitSums);
    return sortHoldings(
      rows.filter((row) => isOpenHolding(row.id, unitsByHolding)),
      options?.sort ?? "default"
    );
  }

  async getHolding(projectId: string, planId: string, holdingId: string) {
    return prisma.planHolding.findFirst({
      where: {
        id: holdingId,
        plan: { id: planId, project_id: projectId },
      },
    });
  }

  async createHolding(
    projectId: string,
    planId: string,
    data: {
      name: string;
      badge: string;
      badge_class_name: string;
      fund_type: string;
      asset_type: string;
      asset_metal: string | null;
      asset_other_name: string | null;
      broker: string;
      broker_name: string | null;
    }
  ) {
    const plan = await prisma.investmentPlan.findFirst({
      where: { id: planId, project_id: projectId },
      select: { id: true },
    });
    if (!plan) return null;

    const sortOrder = await prisma.planHolding.count({ where: { plan_id: planId } });

    return prisma.planHolding.create({
      data: {
        plan_id: planId,
        name: data.name,
        badge: data.badge,
        badge_class_name: data.badge_class_name,
        fund_type: data.fund_type,
        asset_type: data.asset_type,
        asset_metal: data.asset_metal,
        asset_other_name: data.asset_other_name,
        broker: data.broker,
        broker_name: data.broker_name,
        sort_order: sortOrder,
      },
    });
  }

  async updateHolding(
    projectId: string,
    planId: string,
    holdingId: string,
    data: {
      name: string;
      badge: string;
      fund_type?: string;
      asset_type?: string;
      asset_metal?: string | null;
      asset_other_name?: string | null;
      broker?: string;
      broker_name?: string | null;
    }
  ) {
    const holding = await prisma.planHolding.findFirst({
      where: {
        id: holdingId,
        plan: { id: planId, project_id: projectId },
      },
    });
    if (!holding) return null;

    return prisma.planHolding.update({
      where: { id: holdingId },
      data: {
        name: data.name,
        badge: data.badge,
        ...(data.fund_type !== undefined ? { fund_type: data.fund_type } : {}),
        ...(data.asset_type !== undefined ? { asset_type: data.asset_type } : {}),
        ...(data.asset_metal !== undefined ? { asset_metal: data.asset_metal } : {}),
        ...(data.asset_other_name !== undefined ? { asset_other_name: data.asset_other_name } : {}),
        ...(data.broker !== undefined ? { broker: data.broker } : {}),
        ...(data.broker_name !== undefined ? { broker_name: data.broker_name } : {}),
      },
    });
  }

  async patchHoldingCurrentNav(
    projectId: string,
    planId: string,
    holdingId: string,
    nav: number
  ) {
    const holding = await prisma.planHolding.findFirst({
      where: {
        id: holdingId,
        plan: { id: planId, project_id: projectId },
      },
    });
    if (!holding) return null;

    const txns = await prisma.planHoldingTransaction.findMany({
      where: { holding_id: holdingId },
    });
    const totalUnits = txns.reduce((sum, row) => sum + row.units.toNumber(), 0);
    const currentValue = totalUnits > 0 ? totalUnits * nav : 0;

    return prisma.planHolding.update({
      where: { id: holdingId },
      data: {
        current_nav: nav,
        current_value: currentValue,
      },
    });
  }

  async deleteHolding(projectId: string, planId: string, holdingId: string) {
    const holding = await prisma.planHolding.findFirst({
      where: {
        id: holdingId,
        plan: { id: planId, project_id: projectId },
      },
      select: { id: true },
    });
    if (!holding) return false;

    await prisma.planHolding.delete({ where: { id: holdingId } });
    return true;
  }

  async importHoldings(
    projectId: string,
    planId: string,
    funds: {
      name: string;
      badge: string;
      badge_class_name: string;
      fund_type: string;
      asset_type: string;
      invested: number;
      current_value: number;
      current_nav: number | null;
      orders: {
        txn_date: Date;
        nav: number;
        units: number;
        amount: number;
        invested: number;
      }[];
    }[],
    options: { replaceAll: boolean }
  ) {
    return prisma.$transaction(
      async (tx) => {
        const plan = await tx.investmentPlan.findFirst({
          where: { id: planId, project_id: projectId },
          select: { id: true },
        });
        if (!plan) return null;

        let existing = await tx.planHolding.findMany({
          where: { plan_id: planId },
          include: {
            transactions: {
              select: { txn_date: true, nav: true, units: true, amount: true },
            },
          },
        });

        let deleted = 0;
        if (options.replaceAll) {
          const result = await tx.planHolding.deleteMany({ where: { plan_id: planId } });
          deleted = result.count;
          existing = [];
        }

        const holdingByName = new Map(
          existing.map((row) => [
            row.name.trim().toLowerCase(),
            {
              id: row.id,
              txnKeys: new Set(
                row.transactions.map(
                  (txn) =>
                    `${txn.txn_date.toISOString().slice(0, 10)}|${txn.nav.toNumber().toFixed(6)}|${txn.units.toNumber().toFixed(6)}|${txn.amount.toNumber().toFixed(6)}`
                )
              ),
            },
          ])
        );

        let added = 0;
        let skipped = 0;
        let ordersAdded = 0;
        let ordersSkipped = 0;
        let sortOrder = options.replaceAll ? 0 : existing.length;

        for (const fund of funds) {
          const key = fund.name.trim().toLowerCase();
          let holding = holdingByName.get(key);
          if (!holding) {
            const created = await tx.planHolding.create({
              data: {
                plan_id: planId,
                name: fund.name,
                badge: fund.badge,
                badge_class_name: fund.badge_class_name,
                fund_type: fund.fund_type,
                asset_type: fund.asset_type,
                broker: "other",
                broker_name: "MF Central",
                invested: fund.invested,
                current_value: fund.current_value,
                current_nav: fund.current_nav,
                sort_order: sortOrder,
              },
            });
            sortOrder += 1;
            holding = { id: created.id, txnKeys: new Set() };
            holdingByName.set(key, holding);
            added += 1;
          } else {
            skipped += 1;
          }

          const toInsert: {
            holding_id: string;
            txn_date: Date;
            nav: number;
            units: number;
            amount: number;
            invested: number;
          }[] = [];
          for (const order of fund.orders) {
            const txnKey = `${order.txn_date.toISOString().slice(0, 10)}|${order.nav.toFixed(6)}|${order.units.toFixed(6)}|${order.amount.toFixed(6)}`;
            if (holding.txnKeys.has(txnKey)) {
              ordersSkipped += 1;
              continue;
            }
            holding.txnKeys.add(txnKey);
            toInsert.push({
              holding_id: holding.id,
              txn_date: order.txn_date,
              nav: order.nav,
              units: order.units,
              amount: order.amount,
              invested: order.invested,
            });
          }

          if (toInsert.length > 0) {
            await tx.planHoldingTransaction.createMany({ data: toInsert });
            ordersAdded += toInsert.length;
            await this.recalculateHoldingAggregates(holding.id, tx);
          }
        }

        const holdings = await tx.planHolding.findMany({
          where: { plan_id: planId },
          orderBy: { name: "asc" },
        });

        return {
          added,
          skipped,
          deleted,
          orders_added: ordersAdded,
          orders_skipped: ordersSkipped,
          holdings,
        };
      },
      { timeout: 30000 }
    );
  }

  async listPlanTransactions(
    projectId: string,
    planId: string,
    options: { sort?: "newest" | "oldest"; from?: Date; to?: Date } = {}
  ) {
    const plan = await prisma.investmentPlan.findFirst({
      where: { id: planId, project_id: projectId },
      select: { id: true },
    });
    if (!plan) return null;

    const sort = options.sort ?? "newest";
    const orderBy =
      sort === "oldest"
        ? [{ txn_date: "asc" as const }, { created_at: "asc" as const }]
        : [{ txn_date: "desc" as const }, { created_at: "desc" as const }];

    const txnDateFilter =
      options.from || options.to
        ? {
            txn_date: {
              ...(options.from ? { gte: options.from } : {}),
              ...(options.to ? { lte: options.to } : {}),
            },
          }
        : {};

    return prisma.planHoldingTransaction.findMany({
      where: { holding: { plan_id: planId }, ...txnDateFilter },
      include: {
        holding: {
          select: {
            id: true,
            name: true,
            broker: true,
            broker_name: true,
            fund_type: true,
            asset_type: true,
            asset_metal: true,
            asset_other_name: true,
          },
        },
      },
      orderBy,
    });
  }

  async listHoldingTransactions(projectId: string, planId: string, holdingId: string) {
    const holding = await prisma.planHolding.findFirst({
      where: {
        id: holdingId,
        plan: { id: planId, project_id: projectId },
      },
      select: { id: true },
    });
    if (!holding) return null;

    return prisma.planHoldingTransaction.findMany({
      where: { holding_id: holdingId },
      orderBy: [{ txn_date: "desc" }, { created_at: "desc" }],
    });
  }

  async createHoldingTransaction(
    projectId: string,
    planId: string,
    holdingId: string,
    data: {
      txn_date: Date;
      nav: number;
      units: number;
      amount: number;
      invested: number;
    }
  ) {
    const holding = await prisma.planHolding.findFirst({
      where: {
        id: holdingId,
        plan: { id: planId, project_id: projectId },
      },
      select: { id: true },
    });
    if (!holding) return null;

    return prisma.$transaction(async (tx) => {
      const created = await tx.planHoldingTransaction.create({
        data: {
          holding_id: holdingId,
          txn_date: data.txn_date,
          nav: data.nav,
          units: data.units,
          amount: data.amount,
          invested: data.invested,
        },
      });

      await this.recalculateHoldingAggregates(holdingId, tx);
      return created;
    });
  }

  async updateHoldingTransaction(
    projectId: string,
    planId: string,
    holdingId: string,
    transactionId: string,
    data: {
      txn_date: Date;
      nav: number;
      units: number;
      amount: number;
      invested: number;
    }
  ) {
    const existing = await prisma.planHoldingTransaction.findFirst({
      where: {
        id: transactionId,
        holding_id: holdingId,
        holding: { plan: { id: planId, project_id: projectId } },
      },
      select: { id: true },
    });
    if (!existing) return null;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.planHoldingTransaction.update({
        where: { id: transactionId },
        data: {
          txn_date: data.txn_date,
          nav: data.nav,
          units: data.units,
          amount: data.amount,
          invested: data.invested,
        },
      });

      await this.recalculateHoldingAggregates(holdingId, tx);
      return updated;
    });
  }

  async deleteHoldingTransaction(
    projectId: string,
    planId: string,
    holdingId: string,
    transactionId: string
  ) {
    const existing = await prisma.planHoldingTransaction.findFirst({
      where: {
        id: transactionId,
        holding_id: holdingId,
        holding: { plan: { id: planId, project_id: projectId } },
      },
      select: { id: true },
    });
    if (!existing) return false;

    await prisma.$transaction(async (tx) => {
      await tx.planHoldingTransaction.delete({ where: { id: transactionId } });
      await this.recalculateHoldingAggregates(holdingId, tx);
    });
    return true;
  }

  private async recalculateHoldingAggregates(
    holdingId: string,
    tx: Prisma.TransactionClient
  ) {
    const holding = await tx.planHolding.findUnique({
      where: { id: holdingId },
      select: { current_nav: true },
    });

    const txns = await tx.planHoldingTransaction.findMany({
      where: { holding_id: holdingId },
      orderBy: [{ txn_date: "desc" }, { created_at: "desc" }],
    });

    const totalInvestedAmount = txns.reduce(
      (sum, row) => sum + row.amount.toNumber(),
      0
    );
    const totalUnits = txns.reduce((sum, row) => sum + row.units.toNumber(), 0);
    const latestTxnNav = txns[0]?.nav.toNumber() ?? 0;
    const navForValue =
      holding?.current_nav != null && holding.current_nav.toNumber() > 0
        ? holding.current_nav.toNumber()
        : latestTxnNav;
    const hasOpenUnits = totalUnits > OPEN_HOLDING_UNITS_EPSILON;
    const currentValue = hasOpenUnits
      ? navForValue > 0
        ? totalUnits * navForValue
        : totalInvestedAmount
      : 0;

    await tx.planHolding.update({
      where: { id: holdingId },
      data: {
        invested: hasOpenUnits ? totalInvestedAmount : 0,
        current_value: currentValue,
      },
    });
  }

  async networthStats(projectId: string) {
    const holdingSum = await prisma.planHolding.aggregate({
      where: { plan: { project_id: projectId, is_tracked: true } },
      _sum: { current_value: true },
    });

    return {
      total_value: holdingSum._sum.current_value?.toNumber() ?? 0,
    };
  }

  async resolveBySlug(projectId: string, slug: string) {
    const plans = await prisma.investmentPlan.findMany({
      where: { project_id: projectId, is_tracked: true },
      select: { id: true, name: true },
    });
    return plans.find((plan) => planNamesMatchSlug(plan.name, slug)) ?? null;
  }

  async portfolioSummary(projectId: string, planId: string) {
    const plan = await prisma.investmentPlan.findFirst({
      where: { id: planId, project_id: projectId, is_tracked: true },
      select: { id: true, name: true },
    });
    if (!plan) return null;

    const [holdings, unitSums] = await Promise.all([
      prisma.planHolding.findMany({
        where: { plan_id: planId },
        select: { id: true, current_value: true, invested: true },
      }),
      prisma.planHoldingTransaction.groupBy({
        by: ["holding_id"],
        where: { holding: { plan_id: planId } },
        _sum: { units: true },
      }),
    ]);
    const unitsByHolding = remainingUnitsMap(unitSums);
    const openHoldings = holdings.filter((row) => isOpenHolding(row.id, unitsByHolding));
    const totalValue = openHoldings.reduce((sum, row) => sum + row.current_value.toNumber(), 0);
    const invested = openHoldings.reduce((sum, row) => sum + row.invested.toNumber(), 0);
    const currentReturns = totalValue - invested;
    const returnsPct = invested > 0 ? (currentReturns / invested) * 100 : 0;

    return {
      plan_id: plan.id,
      plan_name: plan.name,
      label: "Portfolio",
      total_value: totalValue,
      invested,
      current_returns: currentReturns,
      returns_pct: returnsPct,
      xirr: 0,
    };
  }
}
