-- Add columns required by @shopify/shopify-app-session-storage-prisma v9.
-- See node_modules/@shopify/shopify-app-session-storage-prisma/README.md
-- for the canonical schema. Without these the OAuth callback fails with
-- "Unknown argument `userId`" on session.upsert.

ALTER TABLE "sessions" ADD COLUMN "user_id" BIGINT;
ALTER TABLE "sessions" ADD COLUMN "first_name" TEXT;
ALTER TABLE "sessions" ADD COLUMN "last_name" TEXT;
ALTER TABLE "sessions" ADD COLUMN "email" TEXT;
ALTER TABLE "sessions" ADD COLUMN "locale" TEXT;
ALTER TABLE "sessions" ADD COLUMN "email_verified" BOOLEAN;
ALTER TABLE "sessions" ADD COLUMN "refresh_token" TEXT;
ALTER TABLE "sessions" ADD COLUMN "refresh_token_expires" TIMESTAMP(3);
