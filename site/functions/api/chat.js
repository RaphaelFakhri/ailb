import { json, readJson, authPhone } from "../_shared.js";

export async function onRequestPost(context) {
  const phone = await authPhone(context);
  if (!phone) return json({ error: "unauthorized" }, 401);

  const body = await readJson(context.request);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 1 || message.length > 4000) {
    return json({ error: "invalid_message" }, 400);
  }
  // optional photo: jpeg data URL, already downscaled client-side (~≤500KB)
  let image = null;
  if (typeof body?.image === "string" && body.image.startsWith("data:image/jpeg;base64,")) {
    if (body.image.length > 4 * 1024 * 1024) return json({ error: "image_too_large" }, 413);
    image = body.image;
  }

  // Forward to the OpenClaw relay; the agent can take a while — just await.
  let res;
  try {
    res = await fetch(`${context.env.RELAY_URL}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-relay-secret": context.env.RELAY_SECRET,
      },
      body: JSON.stringify({
        sessionKey: `web:${phone}`,
        message,
        phone: "+" + phone,
        ...(image ? { image } : {}),
      }),
    });
  } catch {
    return json({ error: "agent_unreachable" }, 502);
  }
  if (res.status !== 200) return json({ error: "agent_unreachable" }, 502);

  let data;
  try {
    data = await res.json();
  } catch {
    return json({ error: "agent_unreachable" }, 502);
  }
  if (typeof data?.reply !== "string") {
    return json({ error: "agent_unreachable" }, 502);
  }

  return json({ reply: data.reply });
}
