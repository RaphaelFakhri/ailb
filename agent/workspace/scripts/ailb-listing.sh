#!/bin/bash
# ailb marketplace API helper.
#   ailb-listing.sh search <product|service|gig|gov>
#   ailb-listing.sh create <type> <title> <price> <location> <desc> [tags_csv] [seller]
set -euo pipefail
BASE="https://ailb.pages.dev/api/listings"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-}" in
  search)
    curl -sf "$BASE?type=${2:?type required}"
    ;;
  create)
    SECRET=$(cat "$DIR/.ailb-api-secret")
    TYPE=${2:?type} TITLE=${3:?title} PRICE=${4:-} LOC=${5:-} DESC=${6:?desc} TAGS=${7:-} SELLER=${8:-} \
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
}))
PY
    ;;
  *)
    echo "usage: $0 search <type> | create <type> <title> <price> <location> <desc> [tags_csv] [seller]" >&2
    exit 1
    ;;
esac
