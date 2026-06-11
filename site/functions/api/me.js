import { json, authPhone } from "../_shared.js";

export async function onRequestGet(context) {
  const phone = await authPhone(context);
  if (!phone) return json({ error: "unauthorized" }, 401);
  return json({ phone: "+" + phone });
}
