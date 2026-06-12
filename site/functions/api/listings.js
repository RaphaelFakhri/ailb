// GET  /api/listings?type=product|service|gig|gov  -> {listings:[...]}
//      sellerPhone is private: included only with a valid x-relay-secret header.
//      gov is special: entries with a sellerPhone are PERSONAL files — returned
//      only to their owner (Bearer token) or the trusted agent, never publicly.
// POST /api/listings  (x-relay-secret protected — the agent creates listings)
//      {type, title, price, location, desc, tags?, seller?, images?, sellerPhone?} -> {ok, id}
import { authPhone } from "../_shared.js";

const TYPES = new Set(["product", "service", "gig", "gov"]);

export async function onRequestGet(context) {
  const type = new URL(context.request.url).searchParams.get("type") || "product";
  if (!TYPES.has(type)) return json(400, { error: "bad_type" });
  const trusted = context.request.headers.get("x-relay-secret") === context.env.RELAY_SECRET;
  const idx = await context.env.LISTINGS.get(`idx:${type}`, "json") || [];
  let listings = (await Promise.all(
    idx.map(id => context.env.LISTINGS.get(`l:${id}`, "json"))
  )).filter(Boolean).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if (type === "gov" && !trusted) {
    const phone = await authPhone(context); // digits, no "+"
    listings = listings.filter(l =>
      !l.sellerPhone || (phone && l.sellerPhone.replace(/\D/g, "") === phone)
    );
    // owned files render differently (Continue vs Start)
    for (const l of listings) if (l.sellerPhone) l.mine = true;
  }
  if (!trusted) for (const l of listings) delete l.sellerPhone;
  return json(200, { listings });
}

export async function onRequestPost(context) {
  if (context.request.headers.get("x-relay-secret") !== context.env.RELAY_SECRET)
    return json(401, { error: "unauthorized" });
  let b;
  try { b = await context.request.json(); } catch { return json(400, { error: "bad_json" }); }
  const { type, title, price, location, desc, tags, seller, images, sellerPhone } = b;
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
    images: Array.isArray(images) ? images.slice(0, 8).map(u => String(u).slice(0, 300)) : [],
    sellerPhone: sellerPhone ? String(sellerPhone).slice(0, 20) : null,
    agentVerified: true,
    ts: Date.now(),
  };
  await context.env.LISTINGS.put(`l:${id}`, JSON.stringify(listing));
  const idx = await context.env.LISTINGS.get(`idx:${type}`, "json") || [];
  idx.unshift(id);
  await context.env.LISTINGS.put(`idx:${type}`, JSON.stringify(idx.slice(0, 500)));
  // wake the agent so it can ping buyers with matching watches
  context.waitUntil(notifyNewListing(context.env, listing));
  return json(200, { ok: true, id });
}

// PUT /api/listings (x-relay-secret) {id, ...fields} — merge-update a listing
export async function onRequestPut(context) {
  if (context.request.headers.get("x-relay-secret") !== context.env.RELAY_SECRET)
    return json(401, { error: "unauthorized" });
  let b;
  try { b = await context.request.json(); } catch { return json(400, { error: "bad_json" }); }
  const cur = b.id && await context.env.LISTINGS.get(`l:${b.id}`, "json");
  if (!cur) return json(404, { error: "not_found" });
  const allowed = ["title", "price", "location", "desc", "tags", "seller", "images", "sellerPhone"];
  for (const k of allowed) if (k in b) cur[k] = b[k];
  await context.env.LISTINGS.put(`l:${cur.id}`, JSON.stringify(cur));
  return json(200, { ok: true, id: cur.id });
}

// DELETE /api/listings?id=<id> (x-relay-secret) — remove listing + index entry
export async function onRequestDelete(context) {
  if (context.request.headers.get("x-relay-secret") !== context.env.RELAY_SECRET)
    return json(401, { error: "unauthorized" });
  const id = new URL(context.request.url).searchParams.get("id");
  const cur = id && await context.env.LISTINGS.get(`l:${id}`, "json");
  if (!cur) return json(404, { error: "not_found" });
  await context.env.LISTINGS.delete(`l:${id}`);
  const idx = await context.env.LISTINGS.get(`idx:${cur.type}`, "json") || [];
  await context.env.LISTINGS.put(`idx:${cur.type}`, JSON.stringify(idx.filter(x => x !== id)));
  return json(200, { ok: true });
}

async function notifyNewListing(env, listing) {
  if (!env.RELAY_URL || !env.RELAY_SECRET) return;
  try {
    await fetch(env.RELAY_URL.replace(/\/$/, "") + "/hooks/new-listing", {
      method: "POST",
      headers: { "content-type": "application/json", "x-relay-secret": env.RELAY_SECRET },
      body: JSON.stringify(listing),
    });
  } catch {
    // watcher pings are best-effort; never fail the listing create
  }
}

function json(code, obj) {
  return new Response(JSON.stringify(obj), {
    status: code,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
