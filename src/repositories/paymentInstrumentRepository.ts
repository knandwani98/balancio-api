import { prisma } from "../lib/prisma.js";
import { bankById } from "../data/banks.js";

export class PaymentInstrumentRepository {
  listBankAccounts(userId: string) {
    return prisma.bankAccount.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  createBankAccount(
    userId: string,
    input: {
      bank_id?: string | null;
      bank_name: string;
      nickname: string;
      account_mask?: string | null;
      icon_url?: string | null;
    }
  ) {
    const catalog = input.bank_id ? bankById(input.bank_id) : undefined;
    const icon_url = input.icon_url ?? catalog?.logo_url ?? null;
    return prisma.bankAccount.create({
      data: {
        user_id: userId,
        bank_id: input.bank_id ?? null,
        bank_name: input.bank_name,
        nickname: input.nickname,
        account_mask: input.account_mask ?? null,
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
      nickname?: string;
      account_mask?: string | null;
      icon_url?: string | null;
    }
  ) {
    return prisma.bankAccount.updateMany({
      where: { id, user_id: userId },
      data: patch,
    });
  }

  deleteBankAccount(userId: string, id: string) {
    return prisma.bankAccount.deleteMany({ where: { id, user_id: userId } });
  }

  listCards(userId: string) {
    return prisma.card.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  createCard(
    userId: string,
    input: { card_type: "credit" | "debit"; last4: string; brand: string; nickname?: string | null }
  ) {
    return prisma.card.create({
      data: {
        user_id: userId,
        card_type: input.card_type,
        last4: input.last4,
        brand: input.brand,
        nickname: input.nickname ?? null,
      },
    });
  }

  updateCard(userId: string, id: string, patch: { nickname?: string | null }) {
    return prisma.card.updateMany({
      where: { id, user_id: userId },
      data: patch,
    });
  }

  deleteCard(userId: string, id: string) {
    return prisma.card.deleteMany({ where: { id, user_id: userId } });
  }

  listUpiProfiles(userId: string) {
    return prisma.upiProfile.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  createUpiProfile(userId: string, input: { upi_id: string; nickname: string }) {
    return prisma.upiProfile.create({
      data: {
        user_id: userId,
        upi_id: input.upi_id,
        nickname: input.nickname,
      },
    });
  }

  updateUpiProfile(
    userId: string,
    id: string,
    patch: { upi_id?: string; nickname?: string }
  ) {
    return prisma.upiProfile.updateMany({
      where: { id, user_id: userId },
      data: patch,
    });
  }

  deleteUpiProfile(userId: string, id: string) {
    return prisma.upiProfile.deleteMany({ where: { id, user_id: userId } });
  }
}
