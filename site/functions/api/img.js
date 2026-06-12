// POST /api/img (x-relay-secret) — store a listing photo, body = raw image bytes.
// -> {ok, url: "/api/img/<id>"} ; served by ./img/[id].js from the same KV.
const MAX_BYTES = 2 * 1024 * 1024;

export async function onRequestPost(context) {
  if (context.request.headers.get("x-relay-secret") !== context.env.RELAY_SECRET)
    return json(401, { error: "unauthorized" });
  const body = await context.request.arrayBuffer();
  if (!body.byteLength) return json(400, { error: "empty" });
  if (body.byteLength > MAX_BYTES) return json(413, { error: "too_large" });
  const id = crypto.randomUUID();
  await context.env.LISTINGS.put(`img:${id}`, body);
  return json(200, { ok: true, url: `/api/img/${id}` });
}

function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { "content-type": "application/json" },
  });
}
