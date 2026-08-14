import { prisma } from "../lib/prisma.js";
import { bankById } from "../data/banks.js";
import { toPrismaDecimal } from "../lib/money.js";

const IMPORTABLE_BANK_FILTER = {
  OR: [
    { bank_id: { in: ["kotak", "boi"] } },
    { bank_name: { equals: "Kotak Mahindra Bank", mode: "insensitive" as const } },
    { bank_name: { equals: "Bank of India", mode: "insensitive" as const } },
  ],
};

export class PaymentInstrumentRepository {
  listBankAccounts(projectId: string) {
    return prisma.bankAccount.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
    });
  }

  /** Project bank accounts that support statement import (Kotak, Bank of India). */
  listImportableBankAccounts(projectId: string) {
    return prisma.bankAccount.findMany({
      where: {
        project_id: projectId,
        ...IMPORTABLE_BANK_FILTER,
      },
      orderBy: { created_at: "desc" },
    });
  }

  getBankAccountForProject(projectId: string, id: string) {
    return prisma.bankAccount.findFirst({
      where: { id, project_id: projectId },
    });
  }

  createBankAccount(
    userId: string,
    projectId: string,
    input: {
      bank_id?: string | null;
      bank_name: string;
      nickname?: string | null;
      account_number: number;
      account_type: "savings" | "current";
      current_balance?: number | null;
      icon_url?: string | null;
    }
  ) {
    const catalog = input.bank_id ? bankById(input.bank_id) : undefined;
    const icon_url = input.icon_url ?? catalog?.logo_url ?? null;
    return prisma.bankAccount.create({
      data: {
        project_id: projectId,
        createdBy: userId,
        bank_id: input.bank_id ?? null,
        bank_name: input.bank_name,
        nickname: input.nickname ?? null,
        account_number: input.account_number,
        account_type: input.account_type,
        ...(input.current_balance !== undefined && input.current_balance !== null
          ? { current_balance: toPrismaDecimal(input.current_balance) }
          : {}),
        icon_url,
      },
    });
  }

  /** Ledger opening balance (before summed cleared transactions). */
  setBankAccountLedgerBaseline(projectId: string, id: string, baseline: number) {
    return prisma.bankAccount.updateMany({
      where: { id, project_id: projectId },
      data: { current_balance: toPrismaDecimal(baseline) },
    });
  }

  updateBankAccount(
    projectId: string,
    id: string,
    patch: {
      bank_id?: string | null;
      bank_name?: string;
      nickname?: string | null;
      account_number?: number;
      account_type?: "savings" | "current";
      current_balance?: number | null;
      icon_url?: string | null;
    }
  ) {
    const data: Record<string, unknown> = { ...patch };
    if (patch.current_balance !== undefined && patch.current_balance !== null) {
      data.current_balance = toPrismaDecimal(patch.current_balance);
    }
    return prisma.bankAccount.updateMany({
      where: { id, project_id: projectId },
      data,
    });
  }

  deleteBankAccount(projectId: string, id: string) {
    return prisma.bankAccount.deleteMany({ where: { id, project_id: projectId } });
  }

  listCards(projectId: string) {
    return prisma.card.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
    });
  }

  getCardForProject(projectId: string, id: string) {
    return prisma.card.findFirst({
      where: { id, project_id: projectId },
    });
  }

  createCard(
    userId: string,
    projectId: string,
    input: {
      bank_id?: string | null;
      bank_name: string;
      card_type: "credit" | "debit";
      last4: string;
      brand: string;
      nickname?: string | null;
      icon_url?: string | null;
    }
  ) {
    const catalog = input.bank_id ? bankById(input.bank_id) : undefined;
    const icon_url = input.icon_url ?? catalog?.logo_url ?? null;
    return prisma.card.create({
      data: {
        project_id: projectId,
        user_id: userId,
        bank_id: input.bank_id ?? null,
        bank_name: input.bank_name,
        card_type: input.card_type,
        last4: input.last4,
        brand: input.brand,
        nickname: input.nickname ?? null,
        icon_url,
      },
    });
  }

  updateCard(
    projectId: string,
    id: string,
    patch: {
      bank_id?: string | null;
      bank_name?: string;
      card_type?: "credit" | "debit";
      last4?: string;
      brand?: string;
      nickname?: string | null;
      icon_url?: string | null;
    }
  ) {
    return prisma.card.updateMany({
      where: { id, project_id: projectId },
      data: patch,
    });
  }

  deleteCard(projectId: string, id: string) {
    return prisma.card.deleteMany({ where: { id, project_id: projectId } });
  }

  listWallets(userId: string) {
    return prisma.wallet.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  createWallet(
    userId: string,
    input: {
      name: string;
      nickname?: string | null;
      current_balance?: number;
    }
  ) {
    return prisma.wallet.create({
      data: {
        user_id: userId,
        name: input.name,
        nickname: input.nickname ?? null,
        ...(input.current_balance !== undefined
          ? { current_balance: toPrismaDecimal(input.current_balance) }
          : {}),
      },
    });
  }

  updateWallet(
    userId: string,
    id: string,
    patch: {
      name?: string;
      nickname?: string | null;
      current_balance?: number;
    }
  ) {
    const data: Record<string, unknown> = { ...patch };
    if (patch.current_balance !== undefined) {
      data.current_balance = toPrismaDecimal(patch.current_balance);
    }
    return prisma.wallet.updateMany({
      where: { id, user_id: userId },
      data,
    });
  }

  deleteWallet(userId: string, id: string) {
    return prisma.wallet.deleteMany({ where: { id, user_id: userId } });
  }
}
