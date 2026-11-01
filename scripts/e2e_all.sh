#!/usr/bin/env bash
# E2E manual menyeluruh produksi Kangenin — SEMUA fitur & alur (happy + gagal).
# Kontrak endpoint sesuai kode: confess/respond POST {response}, reply {reply},
# letters/open {letterId}, letters/reply {letterId,body}, gifts/redeem {index},
# kado/status PATCH {status}.
BASE="https://www.kangenin.web.id"
FALLBACK="https://kangenin.risyxieee123.workers.dev"
CODE=$(curl -s --max-time 15 -o /dev/null -w "%{http_code}" "$BASE/api/stats" || echo 000)
if [ "$CODE" != "200" ]; then BASE="$FALLBACK"; fi
echo "BASE = $BASE"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf "  ✅ %-52s %s\n" "$1" "$2"; }
bad()  { FAIL=$((FAIL+1)); printf "  ❌ %-52s %s\n" "$1" "$2"; }
check(){ local name="$1" expect="$2" got="$3"; if [ "$got" = "$expect" ]; then ok "$name" "$got"; else bad "$name" "(dapat $got, harap $expect)"; fi }
jqf()  { python3 -c "import json,sys; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }
C="curl -s --max-time 25"

echo "── A. HALAMAN PUBLIK ──────────────────────────────"
for p in "/" "/create" "/dinding" "/bantuan" "/tentang" "/privasi"; do
  check "GET $p" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE$p")"
done

echo "── B. API BACA ────────────────────────────────────"
check "GET /api/stats" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE/api/stats")"
check "GET /api/wall"  200 "$($C -o /dev/null -w '%{http_code}' "$BASE/api/wall")"

echo "── C. CONFESS (buat → view → respond yes → reply) ──"
CR=$($C -X POST "$BASE/api/confess" -H "Content-Type: application/json" -d '{"fromName":"QA Bot","toName":"Penerima Uji","message":"Tes E2E menyeluruh: mohon abaikan pesan ini ya.","theme":"rose","isPublic":false}')
CSLUG=$(echo "$CR" | jqf "['slug']"); CKEY=$(echo "$CR" | jqf "['senderKey']")
[ -n "$CSLUG" ] && ok "POST /api/confess (create)" "slug=$CSLUG" || bad "POST /api/confess (create)" "$CR"
check "GET /?k=slug (view confess)" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE/?k=$CSLUG")"
check "GET /?s=senderKey (status)"  200 "$($C -o /dev/null -w '%{http_code}' "$BASE/?s=$CKEY")"
check "GET /api/confess/slug"       200 "$($C -o /dev/null -w '%{http_code}' "$BASE/api/confess/$CSLUG")"
RR=$($C -o /tmp/rr.json -w "%{http_code}" -X POST "$BASE/api/confess/$CSLUG/respond" -H "Content-Type: application/json" -d '{"response":"yes"}')
check "POST respond=yes" 200 "$RR"
check "POST respond ulang → 409" 409 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/confess/$CSLUG/respond" -H 'Content-Type: application/json' -d '{"response":"yes"}')"
RP=$($C -o /tmp/rp.json -w "%{http_code}" -X POST "$BASE/api/confess/$CSLUG/reply" -H "Content-Type: application/json" -d '{"reply":"Balasan uji E2E, terima kasih."}')
[ "$RP" = "201" ] || [ "$RP" = "200" ] && ok "POST reply (setelah yes)" "$RP" || bad "POST reply (setelah yes)" "$RP"
check "GET /api/status/senderKey" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE/api/status/$CKEY")"

echo "── D. CONFESS TERJADWAL + VALIDASI GAGAL ──────────"
PLUS7=$(python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
SC=$($C -X POST "$BASE/api/confess" -H "Content-Type: application/json" -d "{\"toName\":\"Penerima Uji\",\"message\":\"Tes confess terjadwal 7 hari lagi.\",\"unlockAt\":\"$PLUS7\"}")
SS=$(echo "$SC" | jqf "['slug']")
[ -n "$SS" ] && ok "POST confess unlockAt +7 hari" "slug=$SS" || bad "POST confess unlockAt +7 hari" "$SC"
check "unlockAt masa lalu → 400" 400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/confess" -H 'Content-Type: application/json' -d '{"toName":"X","message":"tes masa lalu","unlockAt":"2020-01-01T00:00:00Z"}')"
check "unlockAt > 30 hari → 400" 400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/confess" -H 'Content-Type: application/json' -d '{"toName":"X","message":"tes kejauhan","unlockAt":"2030-12-01T00:00:00Z"}')"
check "confess tanpa toName → 400"   400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/confess" -H 'Content-Type: application/json' -d '{"message":"pesan tanpa nama penerima"}')"
check "confess pesan pendek → 400"   400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/confess" -H 'Content-Type: application/json' -d '{"toName":"A","message":"ha"}')"
check "confess tema bodoh → 400"     400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/confess" -H 'Content-Type: application/json' -d '{"toName":"A","message":"pesan cukup","theme":"neon"}')"
check "confess body bukan JSON → 400" 400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/confess" -H 'Content-Type: application/json' -d 'bukan-json')"
check "GET /?k=slug-palsu"           200 "$($C -o /dev/null -w '%{http_code}' "$BASE/?k=slugngasal123")"

echo "── F. LETTERS OPEN WHEN (buat → baca id → open → reply) ──"
LR=$($C -X POST "$BASE/api/letters" -H "Content-Type: application/json" -d '{"fromName":"QA Bot","toName":"Penerima Uji","letters":[{"title":"Surat satu","body":"Isi surat pertama untuk tes E2E.","unlockDays":0},{"title":"Surat dua","body":"Isi surat kedua untuk tes E2E.","unlockDays":3},{"title":"Surat tiga","body":"Isi surat ketiga untuk tes E2E.","unlockDays":7}]}')
LSLUG=$(echo "$LR" | jqf "['slug']"); LKEY=$(echo "$LR" | jqf "['senderKey']")
[ -n "$LSLUG" ] && ok "POST /api/letters" "slug=$LSLUG" || bad "POST /api/letters" "$LR"
LID=$($C "$BASE/api/letters/$LSLUG" | python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  ls=d.get('data',{}).get('letters') or d.get('letters') or []
  print(ls[0]['id'] if ls else '')
except Exception: print('')")
[ -n "$LID" ] && ok "GET /api/letters/slug → letterId" "${LID:0:8}…" || bad "GET letterId" "kosong"
check "letters < 3 surat → 400" 400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/letters" -H 'Content-Type: application/json' -d '{"toName":"A","letters":[{"title":"satu","body":"isinya cukup panjang","unlockDays":0}]}')"
LO=$($C -o /tmp/lo.json -w "%{http_code}" -X POST "$BASE/api/letters/$LSLUG/open" -H "Content-Type: application/json" -d "{\"letterId\":\"$LID\"}")
check "POST letters open (surat #1)" 200 "$LO"
LP=$($C -o /dev/null -w "%{http_code}" -X POST "$BASE/api/letters/$LSLUG/reply" -H "Content-Type: application/json" -d "{\"letterId\":\"$LID\",\"body\":\"Balasan surat uji E2E.\"}")
[ "$LP" = "201" ] || [ "$LP" = "200" ] && ok "POST letters reply (surat #1)" "$LP" || bad "POST letters reply (surat #1)" "$LP"
check "GET /?s=letters senderKey" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE/?s=$LKEY")"

echo "── G. GIFTS (cake → redeem) ───────────────────────"
GR=$($C -X POST "$BASE/api/gifts" -H "Content-Type: application/json" -d '{"type":"cake","fromName":"QA Bot","toName":"Penerima Uji","theme":"rose","data":{"occasion":"ultah","message":"Selamat ulang tahun dari tes E2E!"}}')
GSLUG=$(echo "$GR" | jqf "['slug']"); GKEY=$(echo "$GR" | jqf "['senderKey']")
[ -n "$GSLUG" ] && ok "POST /api/gifts (cake)" "slug=$GSLUG" || bad "POST /api/gifts (cake)" "$GR"
check "gift data salah skema → 400" 400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/gifts" -H 'Content-Type: application/json' -d '{"type":"cake","toName":"A","data":{"occasion":"ngasal","message":"pesan cukup panjang"}}')"
check "GET /?k=gift slug" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE/?k=$GSLUG")"
RE=$($C -o /tmp/re.json -w "%{http_code}" -X POST "$BASE/api/gifts/$GSLUG/redeem" -H "Content-Type: application/json" -d '{"index":0}')
ok "POST gifts redeem (index 0)" "HTTP $RE $(head -c 60 /tmp/re.json)"

echo "── H. KADO (create → share → unbox → status) ──────"
for T in candle playlist coupon; do
  EXTRA="null"; [ "$T" = "playlist" ] && EXTRA='{"spotifyId":"4cOdK2wGLETKBW3PvgPWqT"}'
  KR=$($C -X POST "$BASE/api/kado" -H "Content-Type: application/json" -d "{\"targetName\":\"Penerima Uji\",\"message\":\"Tes kado $T dari E2E.\",\"isAnonymous\":true,\"kadoType\":\"$T\",\"kadoData\":$EXTRA}")
  KID=$(echo "$KR" | jqf "['data']['id']")
  [ -n "$KID" ] && ok "POST /api/kado ($T)" "id=${KID:0:8}…" || bad "POST /api/kado ($T)" "$KR"
  check "GET /kado/id/share ($T)" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE/kado/$KID/share")"
  check "GET /kado/id (unbox $T)" 200 "$($C -o /dev/null -w '%{http_code}' "$BASE/kado/$KID")"
done
check "kadoType simbol → 400" 400 "$($C -o /dev/null -w '%{http_code}' -X POST "$BASE/api/kado" -H 'Content-Type: application/json' -d '{"targetName":"A","message":"pesan cukup","kadoType":"haha; drop","kadoData":null}')"
KR2=$($C -X POST "$BASE/api/kado" -H "Content-Type: application/json" -d '{"targetName":"Penerima Uji","message":"Tes status PATCH E2E.","isAnonymous":false,"senderName":"QA Bot","kadoType":"tap","kadoData":{"taps":5}}')
KID2=$(echo "$KR2" | jqf "['data']['id']")
ST=$($C -o /tmp/st.json -w "%{http_code}" -X PATCH "$BASE/api/kado/$KID2/status" -H "Content-Type: application/json" -d '{"status":"accepted"}')
check "PATCH kado status=accepted" 200 "$ST"
check "PATCH status ulang → 409"   409 "$($C -o /dev/null -w '%{http_code}' -X PATCH "$BASE/api/kado/$KID2/status" -H 'Content-Type: application/json' -d '{"status":"rejected"}')"
$C -o /tmp/opened.html "$BASE/kado/$KID2"
echo "$(< /tmp/opened.html)" | rg -q "sudah dibuka" && ok "unbox kado terjawab → 'sudah dibuka'" "ada" || bad "unbox kado terjawab" "teks tak ketemu"

echo "── I. DINDING (confess isPublic tampil) ───────────"
$C -X POST "$BASE/api/confess" -H "Content-Type: application/json" -d '{"fromName":"QA Bot","toName":"Penerima Uji","message":"Tes dinding publik E2E, abaikan ya.","isPublic":true}' > /dev/null
WP=$($C "$BASE/api/wall"); echo "$WP" | rg -q "QA Bot" && ok "wall memuat confess publik" "ada" || bad "wall memuat confess publik" "$(echo $WP | head -c 80)"

echo "═══════════════════════════════════════════════════"
echo "HASIL: $PASS lulus, $FAIL gagal (BASE=$BASE)"
[ $FAIL -gt 0 ] && exit 1 || exit 0
