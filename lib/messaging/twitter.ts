import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { BaseMessagingProvider } from "./base";
import type { MessagingProvider, OutboundMessage, SendResult, InboundMessage } from "./provider";

/**
 * X (Twitter) Direct Messages via the X API v2.
 *
 * X's DM API requires an OAuth 2.0 user-context token and a paid API tier
 * for DM read/write access, which can change independent of this app.
 * Required env vars: X_CLIENT_ID, X_CLIENT_SECRET.
 *
 * X does not offer real-time DM webhooks on most tiers, so a production
 * implementation of `fetchConversations`/polling would live here instead
 * of a webhook handler — kept out of scope until API access is confirmed.
 */
class TwitterProvider extends BaseMessagingProvider implements MessagingProvider {
  readonly channel = "TWITTER" as const;
  protected dbProvider = "TWITTER" as const;

  isConfigured(): boolean {
    return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
  }

  async getConnectUrl(businessId: string): Promise<string | null> {
    if (!this.isConfigured()) return null;
    const redirectUri = `${process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL}/api/integrations/x/callback`;
    const params = new URLSearchParams({
      client_id: process.env.X_CLIENT_ID!,
      redirect_uri: redirectUri,
      state: businessId,
      response_type: "code",
      scope: "dm.read dm.write tweet.read users.read offline.access",
      code_challenge: "challenge", // production: real PKCE challenge
      code_challenge_method: "plain",
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  }

  async sendMessage(businessId: string, _message: OutboundMessage): Promise<SendResult> {
    const integration = await prisma.integration.findUnique({
      where: { businessId_provider: { businessId, provider: "TWITTER" } },
    });
    if (!integration || integration.status === "NOT_CONNECTED") {
      throw new Error("X is not connected for this business");
    }
    if (integration.status === "MOCK" || !this.isConfigured()) {
      return { providerMessageId: `mock_x_${crypto.randomUUID()}`, status: "SENT" };
    }
    throw new Error("X live send not yet wired — connect an account to enable this path");
  }

  parseWebhookPayload(_payload: unknown): InboundMessage[] {
    // X has no general-availability DM webhook; production would poll
    // GET /2/dm_conversations on an interval instead.
    return [];
  }

  validateWebhookSignature(_input: { payload: string; signatureHeader: string | null }): boolean {
    return false;
  }
}

export const twitterProvider = new TwitterProvider();
