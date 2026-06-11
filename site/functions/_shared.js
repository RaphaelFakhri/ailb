// Shared helpers for ailb Pages Functions.
// Files/dirs starting with "_" are not routed by Cloudflare Pages.

/**
 * Normalize a phone number to international digits, e.g. "96103123456" form.
 * Returns null if invalid (< 10 digits after normalization).
 */
export function normalizePhone(raw) {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  let normalized;
  if (d.startsWith("961") && d.length >= 10) {
    normalized = d;
  } else if (d.startsWith("0") && d.length === 8) {
    normalized = "961" + d.slice(1);
  } else if (d.length === 7 || d.length === 8) {
    normalized = "961" + d;
  } else if (d.length >= 10 && d.length <= 15) {
    normalized = d;
  } else {
    return null;
  }
  if (normalized.length < 10 || normalized.length > 15) return null;
  return normalized;
}

/** JSON response helper. */
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Parse a JSON request body; returns null on bad/missing JSON. */
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Resolve Bearer token -> phone digits via KV, or null. */
export async function authPhone(context) {
  const header = context.request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]+)$/i);
  if (!match) return null;
  const phone = await context.env.SESSIONS.get(`sess:${match[1]}`);
  return phone || null;
}
