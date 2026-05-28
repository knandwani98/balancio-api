import { prisma } from "../lib/prisma.js";
import { bankById } from "../data/banks.js";

export class PaymentInstrumentRepository {
  listBankAccounts(userId: string) {
    return prisma.bankAccount.findMany({
      where: { createdBy: userId },
      orderBy: { created_at: "desc" },
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
        icon_url,
      },
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
      icon_url?: string | null;
    }
  ) {
    return prisma.bankAccount.updateMany({
      where: { id, createdBy: userId },
      data: patch,
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
    }
  ) {
    return prisma.wallet.create({
      data: {
        user_id: userId,
        name: input.name,
        nickname: input.nickname ?? null,
      },
    });
  }

  updateWallet(
    userId: string,
    id: string,
    patch: {
      name?: string;
      nickname?: string | null;
    }
  ) {
    return prisma.wallet.updateMany({
      where: { id, user_id: userId },
      data: patch,
    });
  }

  deleteWallet(userId: string, id: string) {
    return prisma.wallet.deleteMany({ where: { id, user_id: userId } });
  }
}
