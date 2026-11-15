// POST /api/report  { id }  -> flags a visible comment for the site owner to review.
// Reporting never hides a comment by itself; it only raises the report count
// shown on the /admin page, so it can't be abused to silence people.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'not configured' }, 503);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Bad request.' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return json({ error: 'Bad request.' }, 400);
  await env.DB.prepare("UPDATE comments SET reports = MIN(reports + 1, 99) WHERE id = ? AND status = 'visible'").bind(id).run();
  return json({ ok: true });
}
