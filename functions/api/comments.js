// Public comments API (Cloudflare Pages Function).
//   GET  /api/comments  -> list of visible comments
//   POST /api/comments  -> add a comment (JSON: name, message, token, website[honeypot])
//
// Needs, in Cloudflare Pages → Settings:
//   D1 binding  DB                (database created from schema.sql)
//   Secret      TURNSTILE_SECRET  (from Cloudflare Turnstile)
//   Secret      IP_SALT           (any long random text; used to hash IP addresses)
//
// Comments appear immediately unless they contain a web link or a word from
// the blocked list. Those are "held" until approved on the /admin page.

const MAX_NAME = 60;
const MAX_MESSAGE = 2000;
const RATE_LIMIT = 3;           // comments per IP address…
const RATE_WINDOW = 10 * 60;    // …per 10 minutes

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|biz|io|co|ru|cn|xyz|top|site|online|shop|click|link|app|me|us|uk)\b)/i;
const BLOCKED = [
  'fuck', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole', 'dickhead', 'cunt', 'whore', 'slut', 'retard',
  'nigger', 'nigga', 'faggot', 'kike', 'spic', 'chink', 'wetback',
  'viagra', 'cialis', 'casino', 'porn', 'xxx', 'crypto giveaway', 'onlyfans'
];
// Whole words only (plus common endings), so innocent words such as "shittim wood"
// (KJV, Exodus 25), "suspicious" or "Scunthorpe" are not caught.
const BLOCKED_RE = new RegExp('\\b(' + BLOCKED.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|') + ')(s|es|ed|er|ers|ing|ty|y|head|heads)?\\b', 'i');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function clean(s, max) {
  return String(s || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(String(salt || '') + '|' + String(ip || ''));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyTurnstile(token, secret, ip) {
  if (!token || !secret) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const out = await r.json();
    return out.success === true;
  } catch {
    return false;
  }
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'not configured' }, 503);
  const { results } = await env.DB.prepare(
    "SELECT id, name, message, created_at FROM comments WHERE status = 'visible' ORDER BY created_at DESC LIMIT 300"
  ).all();
  return json({ comments: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.TURNSTILE_SECRET) return json({ error: 'Comments are not set up yet.' }, 503);
  if (!sameOrigin(request)) return json({ error: 'Bad request.' }, 403);
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json({ error: 'Bad request.' }, 415);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }

  // Honeypot: real visitors never see or fill this field.
  if (body.website) return json({ ok: true, status: 'visible' });

  const name = clean(body.name, MAX_NAME);
  const message = clean(body.message, MAX_MESSAGE);
  if (name.length < 1) return json({ error: 'Please enter your name.' }, 400);
  if (message.length < 3) return json({ error: 'Please write a comment.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!(await verifyTurnstile(body.token, env.TURNSTILE_SECRET, ip))) {
    return json({ error: 'The human check failed. Please try again.' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const ipHash = await hashIp(ip, env.IP_SALT);
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?'
  ).bind(ipHash, now - RATE_WINDOW).first();
  if (recent && recent.n >= RATE_LIMIT) {
    return json({ error: 'You are posting very quickly. Please wait a few minutes and try again.' }, 429);
  }

  let status = 'visible', reason = null;
  const text = name + '\n' + message;
  if (LINK_RE.test(text)) { status = 'held'; reason = 'contains a link'; }
  else if (BLOCKED_RE.test(text)) { status = 'held'; reason = 'blocked word'; }

  const res = await env.DB.prepare(
    'INSERT INTO comments (name, message, created_at, status, hold_reason, ip_hash) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(name, message, now, status, reason, ipHash).run();

  return json({
    ok: true,
    status,
    comment: status === 'visible' ? { id: res.meta && res.meta.last_row_id, name, message, created_at: now } : null
  });
}
