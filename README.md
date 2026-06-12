# ailb 🇱🇧 — your AI concierge for life in Lebanon

ailb is one agent that handles the errands of Lebanese life. You talk to it — voice note, photo, 3arabe, English, or franco — and it does the work: it prices and sells your used stuff, builds service providers a business profile from a ten-minute interview, and preps your government paperwork so you go once, with everything. No forms, no apps. Khallas, the agent handles it.

**Three pillars:**

1. **Marketplace of things** — send a photo, the agent prices it, writes the listing, answers every buyer, qualifies the serious one, and schedules the handover.
2. **Marketplace of services** — providers onboard by just talking to the bot; the interview *is* the product. Customers ask for "an electrician in Dekwaneh" and get a verified person.
3. **Government services** — guided files (Schengen visa, ikhraj qaid, passport renewal, car transfer): checklist, prefilled forms, validity tracking, appointment plan, one prepared visit. ailb doesn't replace the mukhtar — it makes sure you go once, with everything.

## Live

- **Site:** https://ailb.pages.dev
- **WhatsApp bot:** +961 78 720 415 — [wa.me/96178720415](https://wa.me/96178720415?text=Hi%20ailb)

Both doors lead to the same agent.

## Architecture

```
 ┌──────────────┐        ┌─────────────────────────────┐
 │   WhatsApp   │───────▶│                             │
 │ +961 78 720… │        │   OpenClaw gateway (VM)     │
 └──────────────┘        │   GPT-5.5 agent            │
                         │                             │
 ┌──────────────┐  relay │  ├─ marketplace concierge   │
 │  Web chat    │───────▶│  │  (things + services)     │
 │ ailb.pages.dev│  /chat │  └─ gov-file concierge      │
 └──────┬───────┘        └─────────────────────────────┘
        │ login                        ▲
        ▼                              │ /send (6-digit code
 ┌──────────────────────┐              │  over WhatsApp)
 │ Cloudflare Pages Fns │──────────────┘
 │ /api/login/* /api/chat│   sessions in Workers KV
 └──────────────────────┘
```

Web login is WhatsApp-native: you enter your phone, the agent WhatsApps you a 6-digit code from +961 78 720 415, and the web chat resumes the same identity (`web:<phone>` session key). Your number is never shown to buyers or sellers.

## What the agent actually does (all live, none mocked)

- **Photo → priced listing**: send a photo of what you're selling (WhatsApp or web chat); the agent identifies it, researches used prices on the web, drafts the listing, uploads your photo, and publishes — with a deep link that scrolls to and spotlights your card (`/things/#l-<id>`).
- **Voice notes in Lebanese Arabic**: transcribed on the VM by local Whisper (`infra/transcribe.py`) — no cloud STT, works in 3arabe.
- **Watches**: "I'll ping you when one shows up" is real — watches persist in the agent workspace (`agent/workspace/watches.json`); every new listing fires a webhook (Pages → relay → agent) that matches it against active watches and WhatsApps the watcher with photo + deep link.
- **Buyer ↔ seller mediation**: every listing carries a private `sellerPhone` (stripped from the public API). When a buyer commits, the agent contacts the seller with permission-gated number exchange and relays between the two.
- **Personal gov files**: "save my file" creates a real per-user file visible only to that user's login on `/gov/` (API filters by session token), with a living checklist, a filled-blue **Continue this file** button, and a print preview of everything collected.
- **Listing lifecycle**: the agent can create, update (add photos, change price), and delete listings — delete/edit only for the requester whose number owns the listing.

## Process maps

Scope wasn't guessed — it was mapped. We sticky-noted **15 reality maps** of Lebanese processes A→Z as a real person lives them (sell a car, become a tutor, get a Schengen visa, transfer ownership, renew a passport, …), then applied delete → simplify → automate to each and scored them on a shared rubric (pain, collapse ratio, market, demo feasibility). The three highest-scoring demoable processes — one per pillar — became the build. See [`process-maps/`](process-maps/) (open `index.html` for the ranked dashboard) for the full ranking.

## Local development

The site is an Astro static build plus Cloudflare Pages Functions.

```bash
cd site
npm install
npm run dev          # Astro dev server (UI only, no /api)
```

To exercise the Pages Functions (`/api/*`) locally, build and serve through Wrangler:

```bash
cd site
npm run build        # outputs site/dist/
npx wrangler pages dev dist
```

Deploys read `site/wrangler.toml` (`pages_build_output_dir = "dist"`), so `npx wrangler pages deploy` from `site/` ships the built `dist/` with `site/functions/` picked up automatically.

**Environment:**

| Var / binding  | What it is                                                        |
| -------------- | ----------------------------------------------------------------- |
| `RELAY_URL`    | Base URL of the OpenClaw relay on the VM                           |
| `RELAY_SECRET` | Shared secret sent as `x-relay-secret` on every relay call         |
| `SESSIONS`     | Workers KV namespace binding (codes, rate limits, session tokens)  |

**Relay contract** (the VM side):

- `POST {RELAY_URL}/send` `{phone, text}` → delivers a WhatsApp message (used for login codes). Must return 200.
- `POST {RELAY_URL}/chat` `{sessionKey, message, phone, image?}` → routes the message into the agent and returns `{reply}` when the agent finishes (can take 10–90s; the function just awaits). `image` is an optional JPEG data URL — the relay saves it on disk and hands the agent the path, mirroring how WhatsApp media arrives.
- `POST {RELAY_URL}/hooks/new-listing` `{...listing}` → fired by the Pages function whenever a listing is created; wakes the agent to match it against saved watches and ping watchers.

All require the `x-relay-secret` header. The relay source lives at [`infra/relay-server.js`](infra/relay-server.js); the VM services (gateway, relay, cloudflared tunnel) run as systemd user units ([`infra/systemd-units.txt`](infra/systemd-units.txt), secrets redacted). Marketplace data is seeded/reset with [`site/scripts/seed-listings.mjs`](site/scripts/seed-listings.mjs).

## Hackathon

Built for the **AI Agents Hackathon 2026 — Life in Lebanon** by Raphael Fakhri & team, on a fork of [OpenClaw](https://github.com/openclaw/openclaw). See [HACKATHON.md](HACKATHON.md) for the submission details.
