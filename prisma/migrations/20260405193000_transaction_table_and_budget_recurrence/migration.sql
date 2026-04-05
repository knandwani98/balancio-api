-- AlterEnum
ALTER TYPE "BudgetRecurrence" ADD VALUE 'yearly';
ALTER TYPE "BudgetRecurrence" ADD VALUE 'quarterly';
ALTER TYPE "BudgetRecurrence" ADD VALUE 'weekly';
ALTER TYPE "BudgetRecurrence" ADD VALUE 'daily';

-- AlterTable
ALTER TABLE "money_transaction" RENAME TO "transaction";
