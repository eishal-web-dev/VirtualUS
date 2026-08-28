-- Tenant-integrity hardening for Ashes Connect.
-- This migration scopes external identities/provider ids to the owning tenant
-- instead of treating them as globally unique across every business.

-- Customer identities: derive businessId from the existing customer relation.
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

-- One open logical thread per business/customer/channel. This also prevents
-- duplicate conversations when two webhooks for the same sender arrive at once.
CREATE UNIQUE INDEX "conversations_businessId_customerId_channel_key"
  ON "conversations"("businessId", "customerId", "channel");

-- Provider message ids are only required to be unique inside a channel.
DROP INDEX IF EXISTS "messages_providerMessageId_key";
CREATE UNIQUE INDEX "messages_channel_providerMessageId_key"
  ON "messages"("channel", "providerMessageId");

-- A connected external account must route inbound webhooks to exactly one tenant.
CREATE UNIQUE INDEX "integrations_provider_externalAccountId_key"
  ON "integrations"("provider", "externalAccountId");

-- Shopify ids are scoped to a store, not globally across all merchants.
DROP INDEX IF EXISTS "shopify_customers_shopifyCustomerId_key";
CREATE UNIQUE INDEX "shopify_customers_shopifyStoreId_shopifyCustomerId_key"
  ON "shopify_customers"("shopifyStoreId", "shopifyCustomerId");
CREATE INDEX "shopify_customers_customerId_idx" ON "shopify_customers"("customerId");

DROP INDEX IF EXISTS "shopify_orders_shopifyOrderId_key";
CREATE UNIQUE INDEX "shopify_orders_shopifyCustomerId_shopifyOrderId_key"
  ON "shopify_orders"("shopifyCustomerId", "shopifyOrderId");
