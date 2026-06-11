import type { BudgetRecurrence, PlanFundInputMode, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { NormalizedPlanFund } from "../services/planAllocationMath.js";
import { toPrismaPercentage } from "../services/planAllocationMath.js";
import { computeTimelineEffectiveToChain } from "../services/planTimelineService.js";

const pointInclude = {
  funds: { orderBy: { sort_order: "asc" as const } },
} as const;

const planInclude = {
  points: {
    include: pointInclude,
    orderBy: { effective_from: "asc" as const },
  },
} as const;

export type PlanWithPoints = Prisma.InvestmentPlanGetPayload<{ include: typeof planInclude }>;

export class InvestmentPlanRepository {
  async list(projectId: string) {
    return prisma.investmentPlan.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
      include: {
        points: {
          orderBy: { effective_from: "desc" as const },
          take: 1,
          select: { period_amount: true },
        },
        _count: { select: { points: true } },
      },
    });
  }

  async getById(projectId: string, planId: string): Promise<PlanWithPoints | null> {
    return prisma.investmentPlan.findFirst({
      where: { id: planId, project_id: projectId },
      include: planInclude,
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
      frequency: BudgetRecurrence;
    },
    initialPoint: {
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
          frequency: plan.frequency,
          points: {
            create: {
              effective_from: initialPoint.effective_from,
              effective_to: plan.end_date,
              period_amount: initialPoint.period_amount,
              funds: {
                create: initialPoint.funds.map((f, i) => ({
                  name: f.name,
                  percentage: toPrismaPercentage(f.percentage),
                  input_mode: f.input_mode,
                  sort_order: i,
                })),
              },
            },
          },
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
      frequency?: BudgetRecurrence;
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
            create: funds.map((f, i) => ({
              name: f.name,
              percentage: toPrismaPercentage(f.percentage),
              input_mode: f.input_mode,
              sort_order: i,
            })),
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
            name: f.name,
            percentage: toPrismaPercentage(f.percentage),
            input_mode: f.input_mode,
            sort_order: i,
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
}
