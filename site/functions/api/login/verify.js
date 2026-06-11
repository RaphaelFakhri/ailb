import { normalizePhone, json, readJson } from "../../_shared.js";

const MAX_TRIES = 5;

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const phone = normalizePhone(body?.phone);
  const code = String(body?.code ?? "").replace(/\D/g, "");
  if (!phone) return json({ error: "invalid_phone" }, 400);

  const kv = context.env.SESSIONS;

  // Attempt counter (TTL matches the code's 10-minute window).
  const tries = parseInt((await kv.get(`tries:${phone}`)) || "0", 10);
  if (tries >= MAX_TRIES) return json({ error: "too_many_tries" }, 429);

  const stored = await kv.get(`code:${phone}`);
  if (!stored) return json({ error: "expired" }, 400);

  if (code.length !== 6 || code !== stored) {
    await kv.put(`tries:${phone}`, String(tries + 1), { expirationTtl: 600 });
    return json({ error: "wrong_code" }, 400);
  }

  // Success: burn the code, mint a session token (7 days).
  await kv.delete(`code:${phone}`);
  await kv.delete(`tries:${phone}`);
  const token =
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");
  await kv.put(`sess:${token}`, phone, { expirationTtl: 604800 });

  return json({ token, phone: "+" + phone });
}
