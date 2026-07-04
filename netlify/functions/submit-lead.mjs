// Lead capture for revenuebench.io.
// Saves the lead to Neon (durable) and sends a notification email via Resend
// (best effort). The front-end falls back to mailto if this returns non-2xx,
// so a lead is never lost even before the env vars below are configured.
//
// Env: RESEND_API_KEY, DATABASE_URL, LEAD_NOTIFY_EMAIL, LEAD_FROM
import { neon } from '@neondatabase/serverless';
import { escapeHtml } from './_lib/escape.mjs';

const NOTIFY_EMAIL = process.env.LEAD_NOTIFY_EMAIL || 'carlos.garrido@sandler.com';
const LEAD_FROM = process.env.LEAD_FROM || 'Revenue Bench <hello@revenuebench.io>';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let schemaReady = false;
async function ensureSchema(sql) {
  if (schemaReady) return;
  // Self-healing: create the table on first run in any environment.
  await sql`
    CREATE TABLE IF NOT EXISTS revenue_bench_leads (
      id SERIAL PRIMARY KEY,
      intent TEXT,
      name TEXT,
      company TEXT,
      email TEXT NOT NULL,
      message TEXT,
      source_page TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  schemaReady = true;
}

async function sendNotification(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('submit-lead: RESEND_API_KEY not set, skipping notification email');
    return false;
  }

  const rows = [
    ['Intent', lead.intent],
    ['Name', lead.name],
    ['Company', lead.company],
    ['Email', lead.email],
    ['Message', lead.message],
    ['Source page', lead.source_page],
  ].filter(([, v]) => v != null && String(v).trim() !== '');

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:4px 0;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
    )
    .join('');

  const subjectWho = lead.name || lead.company || lead.email;
  const subjectIntent = lead.intent ? ` (${lead.intent})` : '';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: LEAD_FROM,
      to: [NOTIFY_EMAIL],
      reply_to: lead.email,
      subject: `New Revenue Bench lead: ${subjectWho}${subjectIntent}`,
      html: `
        <p>A new lead just came in from revenuebench.io.</p>
        <table style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;border-collapse:collapse;">${tableRows}</table>
        <p style="margin-top:20px;color:#6b7280;font-size:13px;">Reply directly to this email to respond to the lead.</p>
      `,
    }),
  });

  if (!res.ok) {
    // Resend reports failures (unverified domain, bad key, restricted recipient)
    // as a non-2xx with a JSON error body. Surface it rather than swallow it.
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    console.error(`submit-lead: notification email failed (${res.status}): ${detail}`);
    return false;
  }
  return true;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload;
  try { payload = await req.json(); } catch { payload = {}; }

  // Honeypot: real users never fill this hidden field.
  if (payload.company_website) return json({ success: true });

  const lead = {
    intent: payload.intent || null,
    name: payload.name || null,
    company: payload.company || null,
    email: (payload.email || '').trim() || null,
    message: payload.message || null,
    source_page: payload.source_page || null,
    user_agent: req.headers.get('user-agent') || null,
  };

  if (!lead.email) return json({ error: 'Email is required' }, 400);

  let dbOK = false;
  let emailOK = false;

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      const sql = neon(dbUrl);
      await ensureSchema(sql);
      await sql`
        INSERT INTO revenue_bench_leads (intent, name, company, email, message, source_page, user_agent)
        VALUES (${lead.intent}, ${lead.name}, ${lead.company}, ${lead.email}, ${lead.message}, ${lead.source_page}, ${lead.user_agent})
      `;
      dbOK = true;
    } catch (err) {
      console.error('submit-lead: DB insert failed:', err);
    }
  } else {
    console.warn('submit-lead: DATABASE_URL not set, lead not stored');
  }

  try {
    emailOK = await sendNotification(lead);
  } catch (err) {
    console.error('submit-lead: notification threw:', err);
  }

  if (dbOK || emailOK) return json({ success: true, stored: dbOK, notified: emailOK });

  // Nothing succeeded (likely not configured yet). Signal failure so the
  // front-end falls back to its mailto path and the lead is not lost.
  return json({ error: 'Lead could not be processed' }, 500);
};
