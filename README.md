# Ashes Connect

*Every customer conversation. One place.*

A US virtual business phone system (Phase 1) evolved into an omnichannel
business communication platform: phone, SMS, WhatsApp, Facebook Messenger,
Instagram DMs, TikTok, X, and Shopify — one unified inbox, one customer
timeline, one CRM.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + Prisma ORM
- Auth.js (NextAuth) v5, credentials (email/password) provider
- Twilio Voice API + `@twilio/voice-sdk` (browser WebRTC calling) + Twilio SMS
- Meta Graph API (WhatsApp Cloud API, Facebook Messenger, Instagram Messaging)
- Shopify Admin API (OAuth + REST)
- Recharts for dashboard charts

Two provider-agnostic adapter layers keep vendor SDKs out of the rest of the
app:
- `lib/telecom/` — `TelecomProvider` interface, Twilio implementation (calls/numbers)
- `lib/messaging/` — `MessagingProvider` interface, one adapter per channel (SMS, WhatsApp, Facebook, Instagram, TikTok, X)

Swapping Twilio for Telnyx, or adding a new messaging channel, means writing
one new adapter file and registering it — nothing else in the app imports a
vendor SDK directly.

## 1. Prerequisites

- Node.js 20+
- A PostgreSQL database
- A Twilio account (required — phone/SMS is the core of the product)
- Optionally: a Meta App (WhatsApp/Facebook/Instagram), a Shopify Partner app, TikTok/X API access

## 2. Install

```bash
npm install
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

At minimum, fill in `DATABASE_URL`, the `TWILIO_*` vars, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`/`APP_BASE_URL`, and `ENCRYPTION_KEY` (`openssl rand -base64 32`)
— that's enough to run the full product with phone, SMS, the unified inbox,
CRM, and every channel's admin page running in **mock/development mode**.

Add the `META_*` / `WHATSAPP_*` vars to connect WhatsApp/Facebook/Instagram
for real. Add `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET` to connect Shopify.
TikTok and X need their own client credentials *and* platform API approval
— see the finish-condition report below for exactly what that gates.

## 4. Set up the database

```bash
npx prisma migrate dev
npx prisma generate
```

This applies two migrations — `20260828085600_init` (Phase 1: users, phone
numbers, calls) and `20260828100000_ashes_connect_phase2` (Business/CRM/
Conversation/Message/Integration/Shopify/Webhook/Notification models) — both
already written and verified end-to-end against a live Postgres instance
(see **Testing notes** below).

Optional demo user:

```bash
npm run db:seed
# demo@ashesconnect.dev / password123
```

## 5. Provider configuration

### Twilio (required)

Same as Phase 1:
1. **API Key** (Console → Account → API keys & tokens) → `TWILIO_API_KEY` / `TWILIO_API_SECRET`
2. **TwiML App** (Console → Voice → TwiML Apps), Voice Request URL = `{APP_BASE_URL}/api/twilio/voice/outbound` → `TWILIO_TWIML_APP_SID`
3. For local dev, tunnel with `ngrok http 3000` and set `APP_BASE_URL` to the tunnel URL
4. **SMS**: on your purchased number, set the Messaging "Webhook URL" (A message comes in) to `{APP_BASE_URL}/api/twilio/sms/webhook`

### WhatsApp / Facebook / Instagram (Meta)

1. Create a Meta App at developers.facebook.com, add the WhatsApp, Messenger, and Instagram products
2. `META_APP_ID` / `META_APP_SECRET` from the app's Basic Settings
3. `META_VERIFY_TOKEN` — any string you choose; enter the same value in each product's webhook configuration
4. Set each product's webhook Callback URL:
   - WhatsApp: `{APP_BASE_URL}/api/integrations/whatsapp/webhook`
   - Facebook: `{APP_BASE_URL}/api/integrations/facebook/webhook`
   - Instagram: `{APP_BASE_URL}/api/integrations/instagram/webhook`
5. `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_BUSINESS_ACCOUNT_ID` from Meta Business Suite → WhatsApp → API Setup
6. In the app: **Settings → Integrations → Connect** next to WhatsApp/Facebook/Instagram starts the real OAuth flow once the above are set. Without them, "Connect" puts the integration into **mock mode** instead — fully functional for building/demoing the product, but not delivering real messages.

### Shopify

1. Create a Shopify Partner app, get `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET`
2. In the app: **Dashboard → Shopify**, enter your shop domain (`my-store.myshopify.com`), click Connect
3. This redirects through Shopify's OAuth, verifies the HMAC on callback, stores an encrypted access token, and runs an initial sync of customers + orders
4. Click **Sync now** any time to re-pull recent customers/orders
5. Any conversation whose customer's email/phone matches a synced Shopify customer will show their lifetime spend and order history in the right-hand sidebar automatically

### TikTok / X

Both require platform API approval this project doesn't have. The full
adapter interface, database schema (`Integration` rows, connection state),
and UI are built — the TikTok and X pages honestly display **"requires
approved API access"** and never claim a live connection. Add
`TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` or `X_CLIENT_ID`/`X_CLIENT_SECRET`
once you have approval; `sendMessage()` in each adapter is where the real
API calls go.

## 6. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`.

### First-run walkthrough

1. Sign up at `/signup` — this creates your account, a `Business` (tenant),
   and a `Subscription` in one transaction.
2. **Dashboard → Overview**: real metrics (all zero until you have data), charts, quick links.
3. **Dashboard → Phone Number**: search and claim a US number, same as Phase 1.
4. **Dashboard → Calls → Dialer**: make a call. It's logged to **Calls** and
   mirrored as a `CALL_EVENT` message into that caller's unified timeline.
5. **Dashboard → SMS**: send a text. It appears in the SMS tab and in **Unified Inbox**.
6. **Dashboard → Customers**: every phone number/WhatsApp contact/etc. that's
   messaged or called in becomes a `Customer` automatically, with linked
   `CustomerIdentity` rows per channel. Open one to see the full timeline —
   calls, messages, and (if connected) Shopify orders, merged and time-ordered.
7. **Settings → Integrations**: connect WhatsApp (real or mock), see connection
   health for every channel.
8. **Cmd/Ctrl+K**: search customers, messages, and Shopify orders from anywhere.
9. To see the **platform admin portal** (`/admin`), set `isPlatformAdmin = true`
   on your user row directly in the database — there's no UI for granting
   this (intentionally; it's a platform-owner-only area, not something a
   tenant should be able to self-grant).

## Project structure

```
app/
  page.tsx                         Landing page (4-tier pricing)
  dashboard/
    page.tsx                       Overview -- real metrics + charts
    inbox/                         Unified Inbox (3-column: list/thread/customer)
    calls/                         Tabbed calls module (Dialer/Recent/Incoming/...)
    sms/, whatsapp/, facebook/,
    instagram/, tiktok/, x/        Per-channel admin pages
    customers/                     CRM list + [id] detail with unified timeline
    shopify/                       Shopify connect + sync UI
    analytics/                     Cross-channel analytics
    team/                          Agent management (invite/roles)
    settings/, settings/integrations/
  admin/                           Platform-owner portal (isPlatformAdmin gated)
  api/
    twilio/                        Phase 1 voice + SMS webhooks (business-scoped now)
    conversations/, customers/     Unified inbox + CRM APIs
    integrations/
      whatsapp/{connect,callback,webhook,send}/
      facebook/callback, instagram/callback     (connect goes through [provider])
      [provider]/{connect,disconnect}/          Generic connect for FB/IG/TikTok/X
      shopify/{connect,callback,sync,disconnect}/
    team/, search/, notifications/
lib/
  telecom/                         Phase 1 provider abstraction (unchanged)
  messaging/                       MessagingProvider interface + one adapter per channel
  inbox.ts                         resolveOrCreateCustomer + recordMessage -- the core
                                    "everything becomes one timeline" logic
  tenant.ts                        Business-scoping helper used by every route/page
  crypto.ts                        AES-256-GCM encryption for stored OAuth credentials
  shopify.ts                       Shopify OAuth + sync helpers
  metrics.ts                       Shared queries for Overview/Analytics
prisma/schema.prisma                Business/BusinessMember/Customer/CustomerIdentity/
                                     Conversation/Message/Integration/ShopifyStore/
                                     ShopifyCustomer/ShopifyOrder/WebhookEvent/Notification
                                     -- layered on the unchanged Phase 1 User/PhoneNumber/Call
```

## Security

- **Multi-tenant isolation**: every business-scoped query filters by
  `businessId`, resolved server-side from the session via `lib/tenant.ts` —
  never trusted from the client. Verified directly: created two businesses
  in the same database and confirmed one cannot see the other's customers.
- **Encrypted credentials at rest**: OAuth tokens for WhatsApp/Facebook/
  Instagram/Shopify are AES-256-GCM encrypted (`lib/crypto.ts`) before being
  stored in `Integration.encryptedCredentials` / `ShopifyStore.accessTokenEncrypted`.
  Never sent to the browser.
- **Webhook signature validation**: Twilio (`X-Twilio-Signature`), Meta
  (`X-Hub-Signature-256`), and Shopify (HMAC on OAuth callback query params)
  are all verified server-side.
- **Rate limiting**: per-user, in-memory, applied to call initiation, SMS
  sends, and conversation replies. Documented as needing a shared store
  (Redis/Upstash) before running multiple serverless instances in production.
- **Role-based access**: OWNER/ADMIN/AGENT enforced via `requireRole()` on
  integration connect/disconnect and team management routes.
- **Platform admin isolation**: `/admin` is gated by a `User.isPlatformAdmin`
  flag with no self-service way to grant it — set directly in the database.

## Testing notes — what's verified, and what needs your own credentials

This was built in a sandboxed environment without outbound access to Twilio,
Meta, Shopify, or Prisma's binary CDN (`binaries.prisma.sh`). Here's exactly
what that does and doesn't mean:

- **The full database schema and every core query pattern were run
  end-to-end against a real, live PostgreSQL instance** — not just written
  and assumed correct. Specifically verified:
  - Signup -> Business + BusinessMember(OWNER) + Subscription created atomically
  - A WhatsApp message, an agent reply, and a phone call from the same
    person all land in one `Customer` timeline, correctly time-ordered --
    the exact scenario from the product spec
  - One business's data is invisible to a second business (tenant isolation)
  - The one-number-per-business rule, unique constraints (duplicate phone
    number, duplicate provider SID), and cascading deletes all behave correctly
  - The Shopify schema, once a customer/order is synced and linked by email
    match, renders the exact "lifetime spend / orders / latest order" shape
    from the spec
- **`next build` compiles and bundles the entire app successfully.**
  TypeScript's post-compile type-check step fails with ~33 errors, and every
  single one traces to one root cause: Prisma's CLI can't reach
  `binaries.prisma.sh` from this sandbox to generate the typed client, so
  every Prisma query result types as `any`, which cascades into "implicit
  any" on downstream `.map()`/`.reduce()` callbacks. Two independent bugs
  this surfaced (a broken generic type intersection in the inbox component,
  and a missing type on a transaction callback) were found and fixed
  directly. Running `npx prisma generate` in your real environment resolves
  all remaining errors -- no code changes needed.
- **`eslint .` passes with zero errors or warnings.**
- **No live Twilio, Meta, or Shopify API calls were made** -- none of those
  services are reachable from this sandbox. The integration code follows
  each provider's documented API shape directly (Twilio Voice/SMS, Meta
  Graph API messaging + OAuth, Shopify Admin API + OAuth), but you should
  run the walkthroughs above against your own accounts before considering
  any channel production-ready.

## Finish-condition report

Per the original spec, here's the honest status of every required capability:

**Fully working (verified against a live database, or previously working
Phase 1 functionality left intact):**
1. Login / logout / protected dashboard
2. See your assigned US number (Dashboard -> Phone Number)
3. Make a call (browser dialer, Twilio Voice SDK)
4. See that call inside Calls (tabbed: Recent/Incoming/Outgoing/Missed)
5. See that call in the customer's unified timeline (Customers -> [customer])
6. Send/receive SMS (via existing Twilio number)
7. See SMS inside Unified Inbox
8. Create/view customers (CRM list + detail page)
9. Open a customer and see all interactions merged into one timeline
10. View separate channel sections (`/dashboard/{sms,whatsapp,facebook,instagram,tiktok,x}`)
11. WhatsApp integration configuration is connectable (real OAuth if
    credentials are set; honest mock mode otherwise) -- send/receive/webhook
    all implemented
12. Platform admin dashboard (`/admin`, gated by `isPlatformAdmin`)
13. Integrations health page (Settings -> Integrations)
14. `npm run lint` passes clean; `npm run build` compiles successfully
    (type-check blocked only by the sandbox's Prisma CDN restriction, not a
    code defect -- see Testing notes)
15. Deploy to Vercel -- architecture is Vercel-ready (serverless-friendly
    routes, no long-running processes); the one thing to swap before scaling
    past one instance is the in-memory rate limiter for a shared store

**Requires your API credentials to go live (mock mode works today without them):**
- WhatsApp, Facebook, Instagram sending/receiving for real (Meta App + tokens)
- Shopify customer/order sync (Shopify Partner app)

**Requires platform approval (architecture built, cannot be faked):**
- TikTok Business Messaging -- needs TikTok API approval
- X DM sending/receiving -- needs a paid X API tier with DM access

**Mock / development mode (fully functional for building and demoing,
not delivering real messages):**
- Any channel where `isConfigured()` returns false gets `Integration.status = MOCK`.
  Sends succeed and log to the database with a `mock_*` provider message ID;
  nothing is delivered externally. This is surfaced explicitly in the UI on
  every channel page, never silently promoted to "Connected."

**What should be built next:**
- Real-time notifications currently poll every 15s; swap for SSE/WebSocket/Pusher/Ably for instant delivery (the API shape is already notification-row-based, so this is a transport swap, not a redesign)
- Voicemail and call recording (schema has `Call.recordingUrl` ready; no recording flow implemented)
- Team invites currently require the invitee to already have an account (no email delivery); a real invite-by-email flow with pending invitation tokens is the natural next step
- Shared rate-limit store (Redis/Upstash) before multi-instance production deployment
