#!/bin/bash
# ailb marketplace API helper.
#   ailb-listing.sh search <product|service|gig|gov>     (authed: includes sellerPhone)
#   ailb-listing.sh create <type> <title> <price> <location> <desc> [tags_csv] [seller] [seller_phone] [images_csv]
#   ailb-listing.sh upload-image <file>                  -> {ok,url}
set -euo pipefail
BASE="https://ailb.pages.dev/api/listings"
IMG="https://ailb.pages.dev/api/img"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
SECRET=$(cat "$DIR/.ailb-api-secret")

case "${1:-}" in
  search)
    # rewrite image paths to the jpeg twins: whatsapp phones drop webp images,
    # so the agent must never even see a .webp URL
    curl -sf -H "x-relay-secret: $SECRET" "$BASE?type=${2:?type required}" | python3 -c '
import json, sys
d = json.load(sys.stdin)
for l in d.get("listings", []):
    l["images"] = [u.replace(".webp", ".jpg") for u in l.get("images", [])]
print(json.dumps(d))'
    ;;
  upload-image)
    FILE=${2:?file required}
    # normalize to JPEG ≤720px — WhatsApp drops webp "images" on phones,
    # so everything stored for sending must be jpeg
    TMP=$(mktemp --suffix=.jpg)
    SRC="$FILE" OUT="$TMP" python3 - <<'PY'
import os
from PIL import Image, ImageOps
im = Image.open(os.environ["SRC"])
im = ImageOps.exif_transpose(im).convert("RGB")
im.thumbnail((720, 720))
im.save(os.environ["OUT"], "JPEG", quality=78)
PY
    curl -sf -X POST "$IMG" -H "x-relay-secret: $SECRET" \
      -H "content-type: application/octet-stream" --data-binary "@$TMP"
    rm -f "$TMP"
    ;;
  create)
    TYPE=${2:?type} TITLE=${3:?title} PRICE=${4:-} LOC=${5:-} DESC=${6:?desc} TAGS=${7:-} SELLER=${8:-} SELLER_PHONE=${9:-} IMAGES=${10:-} \
    python3 - <<'PY' | curl -sf -X POST "$BASE" -H "x-relay-secret: $SECRET" -H "content-type: application/json" --data-binary @-
import json, os
print(json.dumps({
    "type": os.environ["TYPE"],
    "title": os.environ["TITLE"],
    "price": os.environ.get("PRICE") or None,
    "location": os.environ.get("LOC", ""),
    "desc": os.environ["DESC"],
    "tags": [t.strip() for t in os.environ.get("TAGS", "").split(",") if t.strip()],
    "seller": os.environ.get("SELLER", ""),
    "sellerPhone": os.environ.get("SELLER_PHONE") or None,
    "images": [u.strip() for u in os.environ.get("IMAGES", "").split(",") if u.strip()],
}))
PY
    ;;
  update)
    # update <id> '<json merge: {"price":"$200","images":[...]}>'
    ID=${2:?id} JSON=${3:?json} python3 -c '
import json, os
b = json.loads(os.environ["JSON"]); b["id"] = os.environ["ID"]
print(json.dumps(b))' | curl -sf -X PUT "$BASE" -H "x-relay-secret: $SECRET" -H "content-type: application/json" --data-binary @-
    ;;
  delete)
    curl -sf -X DELETE "$BASE?id=${2:?id}" -H "x-relay-secret: $SECRET"
    ;;
  *)
    echo "usage: $0 search <type> | upload-image <file> | create <type> <title> <price> <location> <desc> [tags_csv] [seller] [seller_phone] [images_csv] | update <id> <json> | delete <id>" >&2
    exit 1
    ;;
esac
