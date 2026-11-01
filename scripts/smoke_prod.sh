#!/usr/bin/env bash
# Smoke test menyeluruh produksi Kangenin — audit semua fitur.
BASE="https://kangenin.risyxieee123.workers.dev"
say() { printf "%-46s %s\n" "$1" "$2"; }

echo "── HALAMAN PUBLIK ─────────────────────────────"
for p in "/" "/create" "/dinding" "/bantuan" "/tentang" "/privasi"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$p")
  say "GET $p" "HTTP $code"
done

echo "── API READ ───────────────────────────────────"
for p in "/api/stats" "/api/wall" "/api"; do
  code=$(curl -s -o /tmp/sm_$$.json -w "%{http_code}" "$BASE$p")
  say "GET $p" "HTTP $code ($(wc -c < /tmp/sm_$$.json) bytes)"
done

echo "── API CREATE: LETTERS ────────────────────────"
LRESP=$(curl -s -X POST "$BASE/api/letters" -H "Content-Type: application/json" -d '{
  "fromName":"Audit","toName":"Tes Kualitas",
  "letters":[
    {"title":"Hari pertama","body":"Tes audit surat pertama, abaikan ya.","unlockDays":0},
    {"title":"Hari ketiga","body":"Tes audit surat kedua, tetap abaikan.","unlockDays":3},
    {"title":"Minggu depan","body":"Tes audit surat ketiga terakhir.","unlockDays":7}
  ]}')
LSLUG=$(echo "$LRESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('slug',''))" 2>/dev/null)
say "POST /api/letters" "$(echo $LRESP | head -c 120)"
[ -n "$LSLUG" ] && say "GET /letters/$LSLUG" "HTTP $(curl -s -o /dev/null -w '%{http_code}' "$BASE/letters/$LSLUG" 2>/dev/null || echo '-')"

echo "── API CREATE: CONFESS ────────────────────────"
CRESP=$(curl -s -X POST "$BASE/api/confess" -H "Content-Type: application/json" -d '{
  "fromName":"Audit","toName":"Tes Kualitas",
  "message":"Tes audit confess — pesan rahasia untuk pemeriksaan.","theme":"rose"}')
CSLUG=$(echo "$CRESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('slug',''))" 2>/dev/null)
say "POST /api/confess" "$(echo $CRESP | head -c 120)"
[ -n "$CSLUG" ] && say "GET /confess/$CSLUG" "HTTP $(curl -s -o /dev/null -w '%{http_code}' "$BASE/confess/$CSLUG" 2>/dev/null || echo '-')"

echo "── API CREATE: GIFTS (cake) ────────────────────"
GRESP=$(curl -s -X POST "$BASE/api/gifts" -H "Content-Type: application/json" -d '{
  "type":"cake","fromName":"Audit","toName":"Tes Kualitas","theme":"rose",
  "data":{"occasion":"ultah","message":"Tes audit kue ulang tahun digital."}}')
GSLUG=$(echo "$GRESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('slug',''))" 2>/dev/null)
say "POST /api/gifts" "$(echo $GRESP | head -c 120)"
[ -n "$GSLUG" ] && say "GET /gifts/$GSLUG" "HTTP $(curl -s -o /dev/null -w '%{http_code}' "$BASE/gifts/$GSLUG" 2>/dev/null || echo '-')"

echo "── SELESAI ────────────────────────────────────"
rm -f /tmp/sm_$$.json
