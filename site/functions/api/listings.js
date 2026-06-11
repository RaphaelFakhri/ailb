// GET  /api/listings?type=product|service|gig|gov  -> {listings:[...]}
// POST /api/listings  (x-relay-secret protected — the agent creates listings)
//      {type, title, price, location, desc, tags?, seller?} -> {ok, id}
const TYPES = new Set(["product", "service", "gig", "gov"]);

export async function onRequestGet(context) {
  const type = new URL(context.request.url).searchParams.get("type") || "product";
  if (!TYPES.has(type)) return json(400, { error: "bad_type" });
  const idx = await context.env.LISTINGS.get(`idx:${type}`, "json") || [];
  const listings = (await Promise.all(
    idx.map(id => context.env.LISTINGS.get(`l:${id}`, "json"))
  )).filter(Boolean).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return json(200, { listings });
}

export async function onRequestPost(context) {
  if (context.request.headers.get("x-relay-secret") !== context.env.RELAY_SECRET)
    return json(401, { error: "unauthorized" });
  let b;
  try { b = await context.request.json(); } catch { return json(400, { error: "bad_json" }); }
  const { type, title, price, location, desc, tags, seller } = b;
  if (!TYPES.has(type) || !title || !desc) return json(400, { error: "bad_params" });
  const id = crypto.randomUUID().slice(0, 8);
  const listing = {
    id, type,
    title: String(title).slice(0, 120),
    price: price == null ? null : String(price).slice(0, 40),
    location: String(location || "").slice(0, 60),
    desc: String(desc).slice(0, 500),
    tags: Array.isArray(tags) ? tags.slice(0, 6).map(t => String(t).slice(0, 30)) : [],
    seller: String(seller || "").slice(0, 60),
    agentVerified: true,
    ts: Date.now(),
  };
  await context.env.LISTINGS.put(`l:${id}`, JSON.stringify(listing));
  const idx = await context.env.LISTINGS.get(`idx:${type}`, "json") || [];
  idx.unshift(id);
  await context.env.LISTINGS.put(`idx:${type}`, JSON.stringify(idx.slice(0, 500)));
  return json(200, { ok: true, id });
}

function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
