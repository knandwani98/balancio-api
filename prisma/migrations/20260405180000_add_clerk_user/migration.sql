-- CreateEnum
CREATE TYPE "AuthLoginType" AS ENUM ('email', 'google', 'apple', 'github', 'microsoft', 'other');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "first_name" TEXT,
    "last_name" TEXT,
    "username" TEXT,
    "avatar_url" TEXT,
    "login_type" "AuthLoginType" NOT NULL DEFAULT 'email',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- Backfill rows for any Clerk user ids already referenced (pre-FK data)
INSERT INTO "user" ("id", "login_type", "created_at", "updated_at")
SELECT DISTINCT "uid", 'email'::"AuthLoginType", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT "user_id" AS "uid" FROM "category"
    UNION
    SELECT "user_id" FROM "budget"
    UNION
    SELECT "user_id" FROM "money_transaction"
) AS "all_user_ids"
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = "all_user_ids"."uid");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_transaction" ADD CONSTRAINT "money_transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
