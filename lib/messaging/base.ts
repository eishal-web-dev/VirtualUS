import { prisma } from "@/lib/prisma";
import type { IntegrationProvider } from "@prisma/client";
import type { ConnectionStatus } from "./provider";

/**
 * Shared plumbing for every social/messaging adapter: reading and writing
 * the `Integration` row for a business, and reporting connection status
 * consistently across the Settings > Integrations page and each channel's
 * own admin page.
 */
export abstract class BaseMessagingProvider {
  protected abstract dbProvider: IntegrationProvider;

  async getConnectionStatus(businessId: string): Promise<ConnectionStatus> {
    const integration = await prisma.integration.findUnique({
      where: { businessId_provider: { businessId, provider: this.dbProvider } },
    });

    if (!integration) {
      return { status: "NOT_CONNECTED" };
    }

    return {
      status: integration.status,
      accountName: integration.externalAccountName ?? undefined,
      lastError: integration.lastError ?? undefined,
    };
  }

  async disconnect(businessId: string): Promise<void> {
    await prisma.integration.updateMany({
      where: { businessId, provider: this.dbProvider },
      data: {
        status: "NOT_CONNECTED",
        encryptedCredentials: null,
        externalAccountId: null,
        externalAccountName: null,
        connectedAt: null,
      },
    });
  }
}
