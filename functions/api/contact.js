// POST /api/contact -> "Advertise with us" form.
// JSON: name, organization, email, website, category, message, token, company[honeypot]
// Messages are stored privately in the D1 database and shown only on /admin.
// Needs the same settings as comments.js (DB, TURNSTILE_SECRET, IP_SALT).

const LIMIT = 3;            // messages per IP address…
const WINDOW = 60 * 60;     // …per hour
const CATEGORIES = ['Christian University / College', 'Bible School / Course', 'Study Bible / Bible Website', 'Christian Business / Publisher / Tours', 'Sponsorship', 'Other'];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function clean(s, max) {
  return String(s || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, max);
}

async function hashIp(ip, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(salt || '') + '|' + String(ip || '')));
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
    return (await r.json()).success === true;
  } catch {
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.TURNSTILE_SECRET) return json({ error: 'The form is not set up yet.' }, 503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Bad request.' }, 403);
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return json({ error: 'Bad request.' }, 415);

  let b;
  try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  if (b.company) return json({ ok: true });  // honeypot

  const name = clean(b.name, 80);
  const organization = clean(b.organization, 120);
  const email = clean(b.email, 160);
  let website = clean(b.website, 200);
  const category = CATEGORIES.includes(b.category) ? b.category : 'Other';
  const message = clean(b.message, 3000);

  if (!name) return json({ error: 'Please enter your name.' }, 400);
  if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (message.length < 5) return json({ error: 'Please write a short message.' }, 400);
  if (b.agree !== 'yes' && b.agree !== true) return json({ error: 'Please confirm that you agree to the Advertising Policy and Advertiser Terms.' }, 400);
  if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (!(await verifyTurnstile(b.token, env.TURNSTILE_SECRET, ip))) {
    return json({ error: 'The human check failed. Please try again.' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const ipHash = await hashIp(ip, env.IP_SALT);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, now - WINDOW).first();
  if (recent && recent.n >= LIMIT) return json({ error: 'Thanks! We already received your messages. Please try again later.' }, 429);

  await env.DB.prepare(
    'INSERT INTO messages (name, organization, email, website, category, message, created_at, agreed_terms_at, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(name, organization, email, website, category, message, now, now, ipHash).run();

  return json({ ok: true });
}
