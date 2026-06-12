#!/usr/bin/env node
// ailb relay: bridges Cloudflare Pages Functions to the local OpenClaw CLI.
// Endpoints (all JSON, auth via x-relay-secret header):
//   POST /chat {sessionKey, message}  -> {reply}
//   POST /send {phone, text}          -> {ok}
//   GET  /health                      -> {ok}
const http = require("http");
const { execFile } = require("child_process");

const PORT = 18791;
const SECRET = process.env.RELAY_SECRET;
const OC = "/home/opc/.ailb-npm/bin/openclaw";
if (!SECRET) { console.error("RELAY_SECRET missing"); process.exit(1); }

function oc(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(OC, ["--profile", "ailb", ...args],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, PATH: "/home/opc/.asdf/shims:/home/opc/.asdf/bin:" + process.env.PATH } },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || stdout || err.message).slice(0, 500)));
        resolve(stdout);
      });
  });
}

function cleanReply(out) {
  return out.split("\n")
    .filter(l => !l.startsWith("[plugins]") && !l.includes("plugins.allow"))
    .join("\n").trim();
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true });
  if (req.headers["x-relay-secret"] !== SECRET) return json(res, 401, { error: "unauthorized" });
  if (req.method !== "POST") return json(res, 405, { error: "method" });

  let raw = "";
  req.on("data", c => { raw += c; if (raw.length > 8e6) req.destroy(); });
  req.on("end", async () => {
    let body;
    try { body = JSON.parse(raw); } catch { return json(res, 400, { error: "bad_json" }); }
    try {
      if (req.url === "/send") {
        const { phone, text } = body;
        if (!/^\+\d{10,15}$/.test(phone || "") || !text) return json(res, 400, { error: "bad_params" });
        await oc(["message", "send", "--channel", "whatsapp", "--target", phone, "-m", text, "--json"], 30000);
        return json(res, 200, { ok: true });
      }
      if (req.url === "/hooks/new-listing") {
        if (!body || !body.id || !body.title) return json(res, 400, { error: "bad_params" });
        json(res, 200, { ok: true }); // ack immediately; the agent run is fire-and-forget
        const prompt =
          "SYSTEM HOOK (not a user message) - a new listing was just published:\n" +
          JSON.stringify(body).replace(/\.webp/g, ".jpg").slice(0, 1500) +
          "\nFollow the WATCHES protocol in AGENTS.md: read watches.json in the workspace. " +
          "If this listing matches an active watch, send that watcher a short franco WhatsApp ping " +
          "(message tool) with the listing deep link and its first photo as media. " +
          "If nothing matches, do nothing and reply exactly: no-match.";
        oc(["agent", "--agent", "main", "--session-key", "hook:new-listing",
            "--message", prompt, "--timeout", "120"], 140000)
          .catch(e => console.error(new Date().toISOString(), "new-listing hook", e.message));
        return;
      }
      if (req.url === "/chat") {
        const { sessionKey, message, image } = body;
        if (!sessionKey || !message) return json(res, 400, { error: "bad_params" });
        let text = String(message).slice(0, 4000);
        if (typeof image === "string" && image.startsWith("data:image/jpeg;base64,")) {
          // mirror the WhatsApp inbound-media shape: a file on disk + its path in the message
          const fs = require("fs");
          const dir = "/home/opc/ailb-relay/uploads";
          fs.mkdirSync(dir, { recursive: true });
          const file = dir + "/" + require("crypto").randomUUID() + ".jpg";
          fs.writeFileSync(file, Buffer.from(image.slice("data:image/jpeg;base64,".length), "base64"));
          text += "\n[the user attached a photo in the web chat; saved at: " + file + "]";
        }
        const out = await oc(["agent", "--agent", "main", "--session-key", String(sessionKey),
                              "--message", text, "--timeout", "90"], 110000);
        const reply = cleanReply(out);
        if (!reply) return json(res, 502, { error: "empty_reply" });
        return json(res, 200, { reply });
      }
      return json(res, 404, { error: "not_found" });
    } catch (e) {
      console.error(new Date().toISOString(), req.url, e.message);
      return json(res, 502, { error: "upstream", detail: e.message.slice(0, 200) });
    }
  });
});

server.listen(PORT, "127.0.0.1", () => console.log("ailb relay on 127.0.0.1:" + PORT));
