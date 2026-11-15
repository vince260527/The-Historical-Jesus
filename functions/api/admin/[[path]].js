// Private admin API for moderating comments and reading "Advertise with us" messages.
//   GET  /api/admin/comments            POST /api/admin/comments  { id, action: show|hide|delete|clear }
//   GET  /api/admin/messages            POST /api/admin/messages  { id, action: read|unread|delete }
//
// Access control (fails closed — if neither is configured, everyone is refused):
//   1. Cloudflare Access (recommended): set ACCESS_TEAM_DOMAIN (e.g. "vsc.cloudflareaccess.com")
//      and ACCESS_AUD (the application's "Application Audience (AUD) Tag").
//      Every request must carry a valid, signed Access token for that application.
//   2. Backup: ADMIN_PASSWORD secret (at least 16 characters), sent as "Authorization: Bearer <password>".

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function b64urlBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function verifyAccessJwt(token, env) {
  try {
    const team = String(env.ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const [h, p, sig] = token.split('.');
    if (!h || !p || !sig) return false;
    const header = JSON.parse(new TextDecoder().decode(b64urlBytes(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlBytes(p)));
    if (header.alg !== 'RS256') return false;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return false;
    if (payload.nbf && payload.nbf > now + 60) return false;
    if (payload.iss !== 'https://' + team) return false;
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(env.ACCESS_AUD)) return false;

    const certs = await (await fetch('https://' + team + '/cdn-cgi/access/certs', { cf: { cacheTtl: 600 } })).json();
    const jwk = (certs.keys || []).find(k => k.kid === header.kid);
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(sig), new TextEncoder().encode(h + '.' + p));
  } catch {
    return false;
  }
}

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

async function passwordOk(given, expected) {
  if (!expected || expected.length < 16 || !given) return false;
  const a = await sha256(given), b = await sha256(expected);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function authorized(request, env) {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (token && await verifyAccessJwt(token, env)) return true;
  }
  if (env.ADMIN_PASSWORD) {
    const m = /^Bearer\s+(.+)$/.exec(request.headers.get('Authorization') || '');
    if (m && await passwordOk(m[1], env.ADMIN_PASSWORD)) return true;
    await new Promise(r => setTimeout(r, 800));  // slow down password guessing
  }
  return false;
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ error: 'Database not connected.' }, 503);
  if (!(await authorized(request, env))) return json({ error: 'Not authorized.' }, 401);

  const what = (params.path || [])[0];
  const method = request.method;

  if (method === 'POST') {
    // Block cross-site requests: must come from this site and carry our custom header.
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('X-VSC-Admin') !== '1') {
      return json({ error: 'Bad request.' }, 403);
    }
  }

  if (what === 'comments' && method === 'GET') {
    const { results } = await env.DB.prepare(
      "SELECT id, name, message, created_at, status, hold_reason, reports FROM comments ORDER BY (status = 'held') DESC, reports DESC, created_at DESC LIMIT 500"
    ).all();
    return json({ comments: results || [] });
  }

  if (what === 'messages' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, organization, email, website, category, message, created_at, agreed_terms_at, is_read FROM messages ORDER BY is_read ASC, created_at DESC LIMIT 500'
    ).all();
    return json({ messages: results || [] });
  }

  if (method === 'POST' && (what === 'comments' || what === 'messages')) {
    let b;
    try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
    const id = Number(b.id);
    if (!Number.isInteger(id) || id < 1) return json({ error: 'Bad request.' }, 400);
    const SQL = what === 'comments' ? {
      show: "UPDATE comments SET status = 'visible', reports = 0 WHERE id = ?",
      hide: "UPDATE comments SET status = 'hidden' WHERE id = ?",
      clear: 'UPDATE comments SET reports = 0 WHERE id = ?',
      delete: 'DELETE FROM comments WHERE id = ?'
    } : {
      read: 'UPDATE messages SET is_read = 1 WHERE id = ?',
      unread: 'UPDATE messages SET is_read = 0 WHERE id = ?',
      delete: 'DELETE FROM messages WHERE id = ?'
    };
    const sql = SQL[b.action];
    if (!sql) return json({ error: 'Unknown action.' }, 400);
    await env.DB.prepare(sql).bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Not found.' }, 404);
}
