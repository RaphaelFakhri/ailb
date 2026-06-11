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
