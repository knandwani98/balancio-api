import { prisma } from "../lib/prisma.js";
import { bankById } from "../data/banks.js";
import { toPrismaDecimal } from "../lib/money.js";

export class PaymentInstrumentRepository {
  listBankAccounts(userId: string) {
    return prisma.bankAccount.findMany({
      where: { createdBy: userId },
      orderBy: { created_at: "desc" },
    });
  }

  /** User bank accounts that support statement import (Kotak, Bank of India). */
  listImportableBankAccounts(userId: string) {
    return prisma.bankAccount.findMany({
      where: {
        createdBy: userId,
        OR: [
          { bank_id: { in: ["kotak", "boi"] } },
          { bank_name: { equals: "Kotak Mahindra Bank", mode: "insensitive" } },
          { bank_name: { equals: "Bank of India", mode: "insensitive" } },
        ],
      },
      orderBy: { created_at: "desc" },
    });
  }

  getBankAccountForUser(userId: string, id: string) {
    return prisma.bankAccount.findFirst({
      where: { id, createdBy: userId },
    });
  }

  createBankAccount(
    userId: string,
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
  setBankAccountLedgerBaseline(userId: string, id: string, baseline: number) {
    return prisma.bankAccount.updateMany({
      where: { id, createdBy: userId },
      data: { current_balance: toPrismaDecimal(baseline) },
    });
  }

  updateBankAccount(
    userId: string,
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
      where: { id, createdBy: userId },
      data,
    });
  }

  deleteBankAccount(userId: string, id: string) {
    return prisma.bankAccount.deleteMany({ where: { id, createdBy: userId } });
  }

  listCards(userId: string) {
    return prisma.card.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  createCard(
    userId: string,
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
    userId: string,
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
      where: { id, user_id: userId },
      data: patch,
    });
  }

  deleteCard(userId: string, id: string) {
    return prisma.card.deleteMany({ where: { id, user_id: userId } });
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
