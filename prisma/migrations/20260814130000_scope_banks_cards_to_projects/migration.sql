-- AlterTable
ALTER TABLE "bank_account" ADD COLUMN "project_id" UUID;
ALTER TABLE "card" ADD COLUMN "project_id" UUID;

-- Backfill from most recent transaction per instrument
UPDATE "bank_account" ba
SET "project_id" = sub.project_id
FROM (
  SELECT DISTINCT ON (t.bank_account_id) t.bank_account_id, t.project_id
  FROM "transaction" t
  WHERE t.bank_account_id IS NOT NULL
  ORDER BY t.bank_account_id, t.occurred_at DESC
) sub
WHERE ba.id = sub.bank_account_id AND ba.project_id IS NULL;

UPDATE "card" c
SET "project_id" = sub.project_id
FROM (
  SELECT DISTINCT ON (t.card_id) t.card_id, t.project_id
  FROM "transaction" t
  WHERE t.card_id IS NOT NULL
  ORDER BY t.card_id, t.occurred_at DESC
) sub
WHERE c.id = sub.card_id AND c.project_id IS NULL;

-- Backfill from earliest project membership
UPDATE "bank_account" ba
SET "project_id" = sub.project_id
FROM (
  SELECT DISTINCT ON (pm.user_id) pm.user_id, pm.project_id
  FROM "project_member" pm
  ORDER BY pm.user_id, pm.created_at ASC
) sub
WHERE ba."created_by" = sub.user_id AND ba.project_id IS NULL;

UPDATE "card" c
SET "project_id" = sub.project_id
FROM (
  SELECT DISTINCT ON (pm.user_id) pm.user_id, pm.project_id
  FROM "project_member" pm
  ORDER BY pm.user_id, pm.created_at ASC
) sub
WHERE c.user_id = sub.user_id AND c.project_id IS NULL;

-- Backfill from creator's earliest project
UPDATE "bank_account" ba
SET "project_id" = p.id
FROM "project" p
WHERE ba.project_id IS NULL
  AND p.created_by_user_id = ba."created_by"
  AND p.id = (
    SELECT p2.id
    FROM "project" p2
    WHERE p2.created_by_user_id = ba."created_by"
    ORDER BY p2.created_at ASC
    LIMIT 1
  );

UPDATE "card" c
SET "project_id" = p.id
FROM "project" p
WHERE c.project_id IS NULL
  AND p.created_by_user_id = c.user_id
  AND p.id = (
    SELECT p2.id
    FROM "project" p2
    WHERE p2.created_by_user_id = c.user_id
    ORDER BY p2.created_at ASC
    LIMIT 1
  );

DELETE FROM "bank_account" WHERE "project_id" IS NULL;
DELETE FROM "card" WHERE "project_id" IS NULL;

ALTER TABLE "bank_account" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "card" ALTER COLUMN "project_id" SET NOT NULL;

ALTER TABLE "bank_account"
  ADD CONSTRAINT "bank_account_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "card"
  ADD CONSTRAINT "card_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "bank_account_project_id_idx" ON "bank_account"("project_id");
CREATE INDEX "card_project_id_idx" ON "card"("project_id");
