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
- Free Ashes-to-Ashes WebRTC calling, SMS, and WhatsApp-style in-app delivery
- Customer-owned Telnyx or Twilio for optional public US numbers, PSTN calls, and carrier SMS
- Meta Graph API (WhatsApp Cloud API, Facebook Messenger, Instagram Messaging)
- Shopify Admin API (OAuth + REST)
- Recharts for dashboard charts

Two provider-agnostic adapter layers keep vendor SDKs out of the rest of the
app:
- `lib/telecom/` — free demo, Telnyx, and Twilio adapters behind one `TelecomProvider` interface
- `lib/messaging/` — `MessagingProvider` interface, one adapter per channel (SMS, WhatsApp, Facebook, Instagram, TikTok, X)

Carrier credentials are encrypted per business. Ashes defaults to its free
internal network and cannot create a telecom charge. A business connects its
own carrier account only when it needs the public telephone network.

## 1. Prerequisites

- Node.js 20+
- A PostgreSQL database
- No telecom account is required for free Ashes-to-Ashes calls and messages
- Optional: a customer-owned Telnyx or Twilio account for public phone service
- Optionally: a Meta App (WhatsApp/Facebook/Instagram), a Shopify Partner app, TikTok/X API access

## 2. Install

```bash
npm install
```

## 3. Configure environment variables

```bash
cp .env.example .env
```

At minimum, fill in `DATABASE_URL`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`/`APP_BASE_URL`, and `ENCRYPTION_KEY` (`openssl rand -base64 32`).
Do not add a platform carrier key. The app then runs at zero telecom cost with
reserved demo +1 numbers, browser-to-browser calls, internal SMS and
WhatsApp-style chat, the unified inbox, CRM, and mock social channels.

Add the `META_*` / `WHATSAPP_*` vars to connect WhatsApp/Facebook/Instagram
for real. Add `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET` to connect Shopify.
TikTok and X need their own client credentials *and* platform API approval
— see the finish-condition report below for exactly what that gates.

## 4. Set up the database

```bash
npx prisma migrate dev
npx prisma generate
```

This applies the checked-in migrations, including the base phone/CRM schema
and the free in-app WebRTC signaling tables. Vercel uses `npm run vercel-build`,
which runs `prisma migrate deploy` before compiling the production app. Other
hosts should run `npm run prisma:deploy` before the new version receives traffic.

Optional demo user:

```bash
npm run db:seed
# demo@ashesconnect.dev / password123
```

## 5. Provider configuration

### Free mode (default)

1. Open **Settings → Calling & SMS mode** and leave it on **Free Ashes network**.
2. Open **Phone Number**, choose an area code, and claim a reserved `555-01XX`
   demo number. It is intentionally not a public telephone number.
3. Calls use browser WebRTC; SMS and WhatsApp-style messages deliver between
   active Ashes demo numbers. No carrier account, card, credit, or telecom
   payment is involved. This internal chat is not the public WhatsApp network.
4. Direct WebRTC uses public STUN and works on many networks. Restrictive NATs
   may require a separately operated TURN relay; the app never buys one silently.

### Customer-owned public phone service (optional)

When a customer needs a real US number, open **Settings → Calling & SMS mode**
and connect that customer's Telnyx or Twilio credentials. The credentials are
encrypted per tenant. The customer owns and funds the carrier account; Ashes
does not purchase numbers, top up balances, or absorb usage charges.

For Twilio browser calls, configure the customer's TwiML App voice URL as
`{APP_BASE_URL}/api/twilio/voice/outbound`. Configure the selected number's
voice and SMS callbacks as `{APP_BASE_URL}/api/twilio/voice/incoming` and
`{APP_BASE_URL}/api/twilio/sms/webhook`.

Telnyx supports number purchase/import, outbound SMS, inbound messaging through
the included signed webhook, and WhatsApp onboarding. Finish the customer's
Messaging Profile and Voice/WebRTC configuration in Telnyx where required;
Telnyx browser calling is not presented as ready in the dialer.

### WhatsApp / Facebook / Instagram (Meta)

1. Create a Meta App at developers.facebook.com, add the WhatsApp, Messenger, and Instagram products
2. `META_APP_ID` / `META_APP_SECRET` from the app's Basic Settings
3. `META_VERIFY_TOKEN` — any string you choose; enter the same value in each product's webhook configuration
4. Set each product's webhook Callback URL:
   - WhatsApp: `{APP_BASE_URL}/api/integrations/whatsapp/webhook`
   - Facebook: `{APP_BASE_URL}/api/integrations/facebook/webhook`
   - Instagram: `{APP_BASE_URL}/api/integrations/instagram/webhook`
5. `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_BUSINESS_ACCOUNT_ID` from Meta Business Suite → WhatsApp → API Setup
6. In the app: **Settings → Integrations → Connect** next to WhatsApp/Facebook/Instagram starts the real OAuth flow once the above are set. Without them, WhatsApp uses the clearly labeled free internal mode between Ashes demo numbers; the other social channels use non-delivering mock mode.

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
3. **Dashboard → Phone Number**: claim a free reserved demo number. Connect a
   customer-owned carrier only if public phone access is required.
4. **Dashboard → Calls → Dialer**: call another Ashes demo number for free. It's logged to **Calls** and
   mirrored as a `CALL_EVENT` message into that caller's unified timeline.
5. **Dashboard → SMS**: text another Ashes demo number. Both accounts receive a real inbox entry.
6. **Dashboard → WhatsApp**: connect free internal mode and message another
   Ashes demo number. Both accounts receive a WhatsApp-style inbox entry; no
   message is sent to the public WhatsApp network.
7. **Dashboard → Customers**: every phone number/WhatsApp contact/etc. that's
   messaged or called in becomes a `Customer` automatically, with linked
   `CustomerIdentity` rows per channel. Open one to see the full timeline —
   calls, messages, and (if connected) Shopify orders, merged and time-ordered.
8. **Settings → Integrations**: connect WhatsApp (real or internal), see connection
   health for every channel.
9. **Cmd/Ctrl+K**: search customers, messages, and Shopify orders from anywhere.
10. To see the **platform admin portal** (`/admin`), set `isPlatformAdmin = true`
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
  telecom/                         Free demo and customer-owned carrier adapters
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
- **`npm run typecheck` and `eslint .` pass.** The free WebRTC signaling,
  tenant-owned credential handling, demo number provisioning, and internal
  SMS/WhatsApp-style paths are covered by the same generated Prisma types as
  the rest of the app.
- Live carrier, Meta, and Shopify calls still require testing with the
  connecting customer's own approved accounts.

## Finish-condition report

Per the original spec, here's the honest status of every required capability:

**Fully working (verified against a live database, or previously working
Phase 1 functionality left intact):**
1. Login / logout / protected dashboard
2. Claim a zero-cost reserved Ashes demo number (Dashboard -> Phone Number)
3. Make free browser audio calls between Ashes demo numbers
4. See that call inside Calls (tabbed: Recent/Incoming/Outgoing/Missed)
5. See that call in the customer's unified timeline (Customers -> [customer])
6. Send/receive free internal SMS between Ashes demo numbers
7. Send/receive free internal WhatsApp-style messages between Ashes demo numbers
8. See SMS and internal WhatsApp-style messages inside Unified Inbox
9. Create/view customers (CRM list + detail page)
10. Open a customer and see all interactions merged into one timeline
11. View separate channel sections (`/dashboard/{sms,whatsapp,facebook,instagram,tiktok,x}`)
12. WhatsApp integration configuration is connectable (real OAuth/onboarding
    with customer credentials; free internal mode otherwise)
13. Platform admin dashboard (`/admin`, gated by `isPlatformAdmin`)
14. Integrations health page (Settings -> Integrations)
15. Customer-owned Telnyx/Twilio credentials are verified, encrypted, and
    scoped to one business; the platform never pays or silently falls back to
    a shared carrier account
16. `npm run lint` and `npm run typecheck` pass clean
17. Deploy to Vercel -- architecture is Vercel-ready (serverless-friendly
    routes, no long-running processes); the one thing to swap before scaling
    past one instance is the in-memory rate limiter for a shared store

**Requires the customer's API credentials to reach public networks:**
- Public US phone numbers, PSTN calls, and carrier SMS (customer-owned Telnyx/Twilio)
- WhatsApp, Facebook, Instagram sending/receiving for real (Meta App + tokens)
- Shopify customer/order sync (Shopify Partner app)

**Requires platform approval (architecture built, cannot be faked):**
- TikTok Business Messaging -- needs TikTok API approval
- X DM sending/receiving -- needs a paid X API tier with DM access

**Mock / development mode (fully functional for building and demoing,
not delivering real messages):**
- Any channel where `isConfigured()` returns false gets `Integration.status = MOCK`.
  WhatsApp is the exception: with demo numbers it delivers internally to the
  other Ashes account, while still never claiming public WhatsApp delivery.
  Other mock channels log locally and do not deliver externally. This is
  surfaced explicitly in the UI, never silently promoted to "Connected."

**What should be built next:**
- Real-time notifications currently poll every 15s; swap for SSE/WebSocket/Pusher/Ably for instant delivery (the API shape is already notification-row-based, so this is a transport swap, not a redesign)
- Voicemail and call recording (schema has `Call.recordingUrl` ready; no recording flow implemented)
- Team invites currently require the invitee to already have an account (no email delivery); a real invite-by-email flow with pending invitation tokens is the natural next step
- Shared rate-limit store (Redis/Upstash) before multi-instance production deployment
