import { normalizePhone, json, readJson } from "../../_shared.js";

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const phone = normalizePhone(body?.phone);
  if (!phone) return json({ error: "invalid_phone" }, 400);

  const kv = context.env.SESSIONS;

  // Rate limit: one code per phone per 60s.
  if (await kv.get(`rl:${phone}`)) return json({ error: "too_soon" }, 429);
  await kv.put(`rl:${phone}`, "1", { expirationTtl: 60 });

  // 6-digit code from a CSPRNG.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const code = String(buf[0] % 1000000).padStart(6, "0");
  await kv.put(`code:${phone}`, code, { expirationTtl: 600 });

  // Send via the WhatsApp relay.
  let res;
  try {
    res = await fetch(`${context.env.RELAY_URL}/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-relay-secret": context.env.RELAY_SECRET,
      },
      body: JSON.stringify({
        phone: "+" + phone,
        text: `ailb login code: ${code}\nValid 10 minutes. Never share it.`,
      }),
    });
  } catch {
    return json({ error: "send_failed" }, 502);
  }
  if (res.status !== 200) return json({ error: "send_failed" }, 502);

  return json({ ok: true });
}
