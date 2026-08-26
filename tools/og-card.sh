#!/bin/bash
# Revenue Bench OG card renderer.
# Usage: ./og-card.sh <slug> "<Card title>" [tagline]
# Writes deploy/og/<slug>.png at 1200x630 via headless Chrome.
# Canonical home for the pipeline that used to live in a session scratchpad
# (og_cards.py, Sprint 1 2026-07-14). Keep it here so a future run does not
# have to reconstruct it.
set -euo pipefail
SLUG="${1:?slug required}"
TITLE="${2:?title required}"
TAG="${3:-Assessment-led. 90-day replacement guarantee.}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$DIR/deploy/og"
TMP="$(mktemp -d)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
cat > "$TMP/card.html" <<HTML
<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px}
body{background:linear-gradient(135deg,#0C1826 0%,#142236 55%,#0C1826 100%);font-family:'Inter',sans-serif;position:relative}
.frame{position:absolute;inset:28px;border:1px solid rgba(200,145,42,.42)}
.inner{position:absolute;inset:28px;padding:56px 58px;display:flex;flex-direction:column;justify-content:space-between}
.brand{font-size:19px;font-weight:700;letter-spacing:.22em;color:#E4B96A;text-transform:uppercase}
.rule{width:64px;height:3px;background:#C8912A;margin-top:16px}
h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:66px;line-height:1.12;color:#fff;letter-spacing:-.012em;max-width:1010px}
.foot{display:flex;justify-content:space-between;align-items:baseline}
.url{font-size:22px;font-weight:600;color:#E4B96A}
.tag{font-size:17px;font-weight:600;color:#9AA6B4}
</style></head><body>
<div class="frame"></div>
<div class="inner">
  <div><div class="brand">Revenue Bench</div><div class="rule"></div></div>
  <h1>$TITLE</h1>
  <div class="foot"><div class="url">revenuebench.io</div><div class="tag">$TAG</div></div>
</div></body></html>
HTML
"$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=4000 --window-size=1200,630 \
  --screenshot="$OUT/$SLUG.png" "file://$TMP/card.html" 2>/dev/null
rm -rf "$TMP"
echo "wrote $OUT/$SLUG.png"
file "$OUT/$SLUG.png"
