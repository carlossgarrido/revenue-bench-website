# Revenue Bench — revenuebench.io

Production marketing site for Revenue Bench (sales & sales leadership recruitment).
Live at **https://revenuebench.io** on Netlify (site `revenuebench`, ID `85bfbea1-12ad-401d-ac61-d4edd3b66f7e`).

## How deploys work (auto)

**Push to `main` → Netlify builds and deploys production.** No manual step.
The link is a read-only deploy key + webhook (no GitHub App). Config lives in `netlify.toml`:
publish = `deploy/`, functions = `netlify/functions/`, build = `npm install`.

Manual fallback (still works, e.g. if the webhook is ever down):

```
npm install
netlify deploy --prod --site=85bfbea1-12ad-401d-ac61-d4edd3b66f7e
```

## Layout

- `deploy/` — the static site (16 pages: home, 7 core, 8 guides) + SEO/AEO files
  (`sitemap.xml`, `llms.txt`, `robots.txt`, favicon set, `site.webmanifest`).
  **Do not delete `googlee369ac6c96df10b1.html`** — Google Search Console ownership proof.
- `netlify/functions/submit-lead.mjs` — contact form → Neon DB + email via Resend.
- `netlify/functions/inbound.mjs` — hello@revenuebench.io inbound webhook → forward.
- `EMAIL-AND-LEADS-SETUP.md` — full email/leads runbook (env vars, gotchas).

## Notes

- GA4: `G-MQ9Z9HNDWV` on all 16 pages.
- Custom cursor: `deploy/assets/cursor.js`, a gold dot + spring-trailing ring. Desktop pointer
  devices only, respects reduced-motion, self-contained (injects its own CSS), one
  `<script defer src="assets/cursor.js">` per page, live sitewide (every page except the GSC
  verification stub). This is the drop-in reference implementation for catalog element **EL-36**
  in `04_Reference Library/Design Inspiration/Design-Elements-Catalog.md`; keep the two in sync.
- Env vars (`DATABASE_URL`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`) are set in the
  Netlify dashboard, never in this repo.
- The canonical working copy lives in Carlos OS at `01_Domains/Revenue Bench/Website/`
  (this folder IS the repo; the parent Carlos OS snapshot repo ignores it).
