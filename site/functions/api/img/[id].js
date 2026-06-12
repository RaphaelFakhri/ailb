// GET /api/img/<id> — serve a seller-uploaded listing photo from KV.
// Stored by POST /api/img (see ../img.js). Immutable: ids are content-unique.
export async function onRequestGet(context) {
  const id = context.params.id;
  if (!/^[a-f0-9-]{8,40}$/.test(id || "")) return new Response("bad id", { status: 400 });
  const body = await context.env.LISTINGS.get(`img:${id}`, "arrayBuffer");
  if (!body) return new Response("not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
