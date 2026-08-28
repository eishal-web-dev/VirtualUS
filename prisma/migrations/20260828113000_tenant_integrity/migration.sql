-- Tenant-integrity hardening for Ashes Connect.

-- Customer identities belong to a business, so the same phone/handle can
-- legitimately exist in two separate Ashes Connect tenants.
ALTER TABLE "customer_identities" ADD COLUMN "businessId" TEXT;
UPDATE "customer_identities" AS ci
SET "businessId" = c."businessId"
FROM "customers" AS c
WHERE ci."customerId" = c."id";
ALTER TABLE "customer_identities" ALTER COLUMN "businessId" SET NOT NULL;

DROP INDEX IF EXISTS "customer_identities_platform_externalId_key";
CREATE UNIQUE INDEX "customer_identities_businessId_platform_externalId_key"
  ON "customer_identities"("businessId", "platform", "externalId");
CREATE INDEX "customer_identities_businessId_idx" ON "customer_identities"("businessId");
ALTER TABLE "customer_identities"
  ADD CONSTRAINT "customer_identities_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Prevent duplicate logical conversations during concurrent webhooks.
CREATE UNIQUE INDEX "conversations_businessId_customerId_channel_key"
  ON "conversations"("businessId", "customerId", "channel");

-- Nullable provider ids cannot safely participate in a Prisma compound unique
-- constraint, so use a generated application-level dedupe key instead.
ALTER TABLE "messages" ADD COLUMN "dedupeKey" TEXT;
UPDATE "messages"
SET "dedupeKey" = "channel"::text || ':' || "providerMessageId"
WHERE "providerMessageId" IS NOT NULL;
DROP INDEX IF EXISTS "messages_providerMessageId_key";
CREATE UNIQUE INDEX "messages_dedupeKey_key" ON "messages"("dedupeKey");

-- Same pattern for connected external accounts. routingKey is
-- PROVIDER:externalAccountId and is null for mock/unconnected integrations.
ALTER TABLE "integrations" ADD COLUMN "routingKey" TEXT;
UPDATE "integrations"
SET "routingKey" = "provider"::text || ':' || "externalAccountId"
WHERE "externalAccountId" IS NOT NULL;
CREATE UNIQUE INDEX "integrations_routingKey_key" ON "integrations"("routingKey");

-- Shopify ids are scoped to a store/customer, not globally across merchants.
DROP INDEX IF EXISTS "shopify_customers_shopifyCustomerId_key";
CREATE UNIQUE INDEX "shopify_customers_shopifyStoreId_shopifyCustomerId_key"
  ON "shopify_customers"("shopifyStoreId", "shopifyCustomerId");
CREATE INDEX "shopify_customers_customerId_idx" ON "shopify_customers"("customerId");

DROP INDEX IF EXISTS "shopify_orders_shopifyOrderId_key";
CREATE UNIQUE INDEX "shopify_orders_shopifyCustomerId_shopifyOrderId_key"
  ON "shopify_orders"("shopifyCustomerId", "shopifyOrderId");
