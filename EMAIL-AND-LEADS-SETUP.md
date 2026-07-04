# Revenue Bench — Email + Lead Capture Setup

**STATUS: LIVE and verified end-to-end 2026-06-21.** Lead capture saves to Neon + emails from
`hello@revenuebench.io`; inbound `hello@` mail forwards to `carlos.garrido@sandler.com`. Resend on
**Pro** ($20/mo). Neon project **`revenue-bench`** (`rapid-bird-36896553`). Netlify env vars
`DATABASE_URL` / `RESEND_API_KEY` / `RESEND_WEBHOOK_SECRET` set (standard vars). Webhook
`email.received` → `/api/inbound`.

> **If inbound ever stops working, check this first:** Resend → Domains → revenuebench.io → Records →
> the **"Enable Receiving" toggle must be ON**. It silently reset during initial setup and had to be
> re-enabled. No webhook events + bounced mail = receiving is off.

The rest of this doc is the original build/runbook reference.

## What ships in the code (live now)

Two Netlify Functions in `netlify/functions/`, fronted by `/api/*` (see `netlify.toml`):

- **`submit-lead.mjs`** — the contact form (`/api/submit-lead`). Saves the lead to a Neon
  Postgres table `revenue_bench_leads` (durable), then sends a notification email via Resend
  (best effort). Has a hidden honeypot field for spam.
- **`inbound.mjs`** — the Resend inbound webhook (`/api/inbound`). Verifies the Svix signature,
  fetches the full message via the Resend Receiving API, and forwards it to a real inbox so
  `hello@revenuebench.io` mail is readable.

`deploy/contact.html` now POSTs to `/api/submit-lead` and shows an inline "thank you" card on
success. **If the function is unreachable or not yet configured, it falls back to the old
`mailto:` automatically** — so no lead is ever lost, even before the steps below are done.

All Resend calls use `fetch` directly and inspect the response, so an unverified domain or bad
key is logged, never silently dropped (the bug that once muted Best Sales Team Training).

## Environment variables (set in Netlify → site `revenuebench` → Environment variables)

Carlos sets these himself; never paste a key into chat.

| Variable | Needed for | Notes |
|---|---|---|
| `RESEND_API_KEY` | lead email + inbound forward | The **same** key as Best Sales Team Training (same Resend account). |
| `DATABASE_URL` | lead storage | Neon Postgres connection string. |
| `RESEND_WEBHOOK_SECRET` | inbound webhook | The `whsec_...` signing secret from the Resend webhook. |
| `INBOUND_FORWARD_TO` | inbound forward | Real inbox where `hello@revenuebench.io` mail should land. |
| `LEAD_NOTIFY_EMAIL` | lead email | Optional. Where new-lead emails go. Default `carlos.garrido@sandler.com`. |
| `LEAD_FROM` / `INBOUND_FROM` | from address | Optional. Default `Revenue Bench <hello@revenuebench.io>`. |

After changing env vars, redeploy so functions pick them up:
`cd "01_Domains/Revenue Bench/Website" && netlify deploy --prod --site=85bfbea1-12ad-401d-ac61-d4edd3b66f7e`

## Fastest path to capturing leads (no DNS wait)

Set **`DATABASE_URL` + `RESEND_API_KEY`** and redeploy. Leads then save to Neon **immediately**,
before any DNS work. DNS verification below only adds the branded notification email and the
`hello@revenuebench.io` inbox. (Optional accelerator: temporarily set `LEAD_FROM` to a
Best-Sales-Team-Training verified address to get notification emails before revenuebench.io is
verified for sending.)

## Activation steps

1. **Resend → Domains → Add domain → `revenuebench.io`** (same account as BSTT). Copy the SPF,
   DKIM, DMARC, and return-path records it shows.
2. **Resend → enable Receiving / inbound** on the domain. Copy the **MX record** for receiving.
3. **GoDaddy DNS** (customer #636438082): add all records from steps 1–2 in one session.
   GoDaddy requires Carlos's email/phone identity verification on each change, so batch them.
   - Sending records live on the `send` subdomain + `resend._domainkey` + `_dmarc` (no root MX).
   - Inbound MX goes on the **root** `@` (gives the clean `hello@revenuebench.io` address; root
     has no other mail today). A subdomain works too if you prefer.
4. **Resend → Verify** the domain (DNS can take minutes to hours).
5. **Resend → Webhooks → Add endpoint** `https://revenuebench.io/api/inbound`, event
   `email.received`. Copy the **signing secret** (`whsec_...`).
6. **Neon → create/choose a project**, copy the connection string.
7. **Netlify → env vars** (table above), then redeploy.
8. **Test:** submit the contact form (expect the thank-you card; a row in
   `revenue_bench_leads`; a notification email). Email `hello@revenuebench.io` and confirm it
   forwards to `INBOUND_FORWARD_TO`.

## Deploy command (changed — functions need it)

The static-only `--dir` deploy no longer covers functions. Deploy from the `Website` directory
so `netlify.toml` (publish=`deploy`, functions=`netlify/functions`) is read:

```
cd "01_Domains/Revenue Bench/Website"
npm install        # first run, or when dependencies change
netlify deploy --prod --site=85bfbea1-12ad-401d-ac61-d4edd3b66f7e
```

## Notes / future

- Inbound forwarding lists attachment names but does not re-attach files (v1). The raw message
  is available in the Resend dashboard. Re-attaching is a future enhancement.
- `revenue_bench_leads` is self-creating on first insert. Query history directly in Neon.
