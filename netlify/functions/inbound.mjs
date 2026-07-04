// Resend inbound webhook for hello@revenuebench.io.
// Resend POSTs an `email.received` event (metadata only). We verify the Svix
// signature, fetch the full message via the Receiving API, then forward it to
// a real inbox so Carlos and Steve can read and reply.
//
// Env: RESEND_API_KEY, RESEND_WEBHOOK_SECRET, INBOUND_FORWARD_TO, INBOUND_FROM
import crypto from 'node:crypto';
import { escapeHtml } from './_lib/escape.mjs';

const FORWARD_TO =
  process.env.INBOUND_FORWARD_TO || process.env.LEAD_NOTIFY_EMAIL || 'carlos.garrido@sandler.com';
const INBOUND_FROM = process.env.INBOUND_FROM || 'Revenue Bench <hello@revenuebench.io>';

function reply(message, status = 200) {
  return new Response(message, { status });
}

// Verify the Svix signature Resend sends on every webhook.
// Signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with the
// base64 secret (after the whsec_ prefix), compared against the v1 signatures.
function verifySignature(secret, headers, rawBody) {
  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const sigHeader = headers.get('svix-signature');
  if (!id || !timestamp || !sigHeader) return false;

  // Reject stale messages (5 min tolerance) to blunt replay attacks.
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1];
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

async function fetchReceived(emailId, apiKey) {
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`retrieve received email failed (${res.status}): ${detail}`);
  }
  return res.json();
}

async function forward(email, apiKey) {
  const fromOriginal =
    (email.headers && email.headers.from) ||
    (Array.isArray(email.from) ? email.from.join(', ') : email.from) ||
    'unknown sender';
  const toOriginal = Array.isArray(email.to) ? email.to.join(', ') : email.to || '';
  const replyTo = Array.isArray(email.from) ? email.from[0] : email.from;

  const attachNote =
    Array.isArray(email.attachments) && email.attachments.length
      ? `<p style="color:#6b7280;font-size:13px;">${email.attachments.length} attachment(s): ${email.attachments
          .map((a) => escapeHtml(a.filename))
          .join(', ')}. View them in the Resend dashboard.</p>`
      : '';

  const bodyHtml =
    email.html ||
    (email.text
      ? `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(email.text)}</pre>`
      : '<p>(no body)</p>');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: INBOUND_FROM,
      to: [FORWARD_TO],
      reply_to: replyTo,
      subject: `[revenuebench.io] ${email.subject || '(no subject)'}`,
      html: `
        <p style="color:#6b7280;font-size:13px;margin:0 0 4px;"><strong>From:</strong> ${escapeHtml(fromOriginal)}</p>
        <p style="color:#6b7280;font-size:13px;margin:0 0 16px;"><strong>To:</strong> ${escapeHtml(toOriginal)}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;">
        ${bodyHtml}
        ${attachNote}
      `,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    throw new Error(`forward email failed (${res.status}): ${detail}`);
  }
}

export default async (req) => {
  if (req.method !== 'POST') return reply('Method not allowed', 405);

  const rawBody = await req.text();
  const apiKey = process.env.RESEND_API_KEY;
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    // Not configured yet. Acknowledge so Resend does not retry forever.
    console.warn('inbound: RESEND_WEBHOOK_SECRET not set, ignoring event');
    return reply('not configured', 200);
  }

  if (!verifySignature(secret, req.headers, rawBody)) {
    console.error('inbound: signature verification failed');
    return reply('invalid signature', 401);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return reply('bad payload', 400); }

  if (event.type !== 'email.received') return reply('ignored', 200);

  const emailId = event.data && event.data.email_id;
  if (!emailId) return reply('no email_id', 200);
  if (!apiKey) {
    console.error('inbound: RESEND_API_KEY not set, cannot fetch/forward');
    return reply('missing api key', 500);
  }

  try {
    const full = await fetchReceived(emailId, apiKey);
    await forward(full, apiKey);
    console.log('inbound: forwarded', emailId);
  } catch (err) {
    console.error('inbound: processing failed:', err);
    return reply('processing error', 500);
  }

  return reply('ok', 200);
};
