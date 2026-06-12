# TOOLS.md - ailb's backend

## The marketplace API (live site: https://ailb.pages.dev)

One script does everything: `scripts/ailb-listing.sh`

### Search listings (no secret needed — public data)
```bash
scripts/ailb-listing.sh search product      # things for sale
scripts/ailb-listing.sh search service      # recurring providers
scripts/ailb-listing.sh search gig          # one-time jobs
scripts/ailb-listing.sh search gov          # guided files
```
Returns JSON: `{listings:[{id,title,price,location,desc,tags,seller,...}]}` — newest first.

### Create a listing (after the person confirms the draft!)
```bash
scripts/ailb-listing.sh create <type> <title> <price> <location> <desc> [tags_csv] [seller_first_name]
# example:
scripts/ailb-listing.sh create product "iPhone 12, 128GB" '$310' "Achrafieh" "Battery 88%, IMEI checked clean. 48h return window." "phone,verified" "Rita"
```
Prints `{ok:true,id:...}` on success. Then send the person the right page link:
- product → https://ailb.pages.dev/things/
- service → https://ailb.pages.dev/services/
- gig → https://ailb.pages.dev/gigs/
- gov → https://ailb.pages.dev/gov/ (boss only)

### Notes
- Price is a display string — write it like Lebanon talks: `$310`, `from $25/visit`, `quoted once, in writing`.
- Seller = first name only. Never full names, never phone numbers in listings.
- The API secret lives in `.ailb-api-secret` at the workspace root. **Never print it, never paste it in chat.**

## Deep links + photos — always show, not just tell

Every listing has a permanent deep link that scrolls to and highlights its card:
- product → `https://ailb.pages.dev/things/#l-<id>`
- service → `https://ailb.pages.dev/services/#l-<id>`
- gig     → `https://ailb.pages.dev/gigs/#l-<id>`

Search results include `images` (paths like `/images/things/iphone-12/1.webp`);
prefix with `https://ailb.pages.dev` for the full URL.

**When you recommend a specific listing, always include its deep link, and send
its first photo as media** (message tool `media` param, or attach it to your
reply if the channel supports it). A photo + link closes deals; a bare page
link makes people scroll and give up.

## Sending photos on WhatsApp — ALWAYS use the .jpg variant

WhatsApp phones silently DROP messages whose attached image is webp (webp is
the sticker format). Every listing photo has a jpeg twin at the same path:
`/images/things/iphone-12/1.webp` → `https://ailb.pages.dev/images/things/iphone-12/1.jpg`

- message tool media / photo attachments → use the **.jpg** URL, never .webp
- links inside message text (deep links, pages) are fine as-is
- /api/img/... uploads are already jpeg — safe to send directly

## Editing and deleting listings — owners only

```bash
scripts/ailb-listing.sh update <id> '{"price":"$250"}'        # merge any fields
scripts/ailb-listing.sh update <id> '{"images":["/api/img/<uuid>"]}'
scripts/ailb-listing.sh delete <id>
```

**Ownership rule:** only act when the requester's WhatsApp number (from this
chat) equals the listing's `sellerPhone` in authed search. Anyone else asking
to edit/delete someone's listing gets a polite no — even the buyer, even if
they're nice about it. Listings without sellerPhone: ask the boss (Raphael).

Adding a photo to an existing listing = upload-image first, then update with
the FULL images array (update replaces the array, it does not append — fetch
current images from search, add the new url, send the whole list).
