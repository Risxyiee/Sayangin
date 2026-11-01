#!/usr/bin/env bash
# Audit END-TO-END semua alur API produksi Kangenin — bukan cuma create.
# Menguji lifecycle penuh tiap fitur + mencatat latensi tiap panggilan
# (flag SLOW bila > 3 dtk — selaras query_timeout koneksi).
BASE="https://kangenin.risyxieee123.workers.dev"
PASS=0; FAIL=0; SLOW=0
say()  { printf "%-52s %s\n" "$1" "$2"; }
# api <label> <method> <path> [json-body] -> simpan body di /tmp/audit.json, catat kode+waktu
api() {
  local label="$1" method="$2" path="$3" body="$4"
  local t0 t1 code
  t0=$(date +%s%N)
  if [ -n "$body" ]; then
    code=$(curl -s -o /tmp/audit.json -w "%{http_code}" -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" -d "$body")
  else
    code=$(curl -s -o /tmp/audit.json -w "%{http_code}" -X "$method" "$BASE$path")
  fi
  t1=$(date +%s%N)
  local ms=$(( (t1 - t0) / 1000000 ))
  local flag=""
  if [ "$ms" -gt 3000 ]; then flag=" ⚠️SLOW"; SLOW=$((SLOW+1)); fi
  say "$label" "HTTP $code ${ms}ms$flag"
  echo "$code" > /tmp/audit_code
}
jget() { python3 -c "
import json,sys
try:
    d=json.load(open('/tmp/audit.json'))
    cur=d
    for k in '$1'.split('.'):
        if k=='' : break
        if isinstance(cur,list): cur=cur[int(k)]
        else: cur=cur.get(k)
    print(cur if cur is not None else '')
except Exception: print('')
"; }
ok()  { PASS=$((PASS+1)); }
bad() { FAIL=$((FAIL+1)); say "  ❌ GAGAL: $1" "$(head -c 160 /tmp/audit.json)"; }
expect() { # expect <kode_yang_diharapkan> <nama_cek>
  local want="$1" name="$2"; local got; got=$(cat /tmp/audit_code)
  if [ "$got" = "$want" ]; then ok; else bad "$name (harap $want, dapat $got)"; fi
}

echo "═══ 1. CONFESS: buat → baca → respons → balas → pantau ═══"
api "POST /api/confess" POST /api/confess \
  '{"fromName":"Audit","toName":"Tes Alur","message":"Audit alur lengkap confess — tes otomatis, abaikan.","theme":"matcha","isPublic":false}'
expect 201 "confess create"
CSLUG=$(jget slug); CKEY=$(jget senderKey)
api "GET  /api/confess/$CSLUG" GET "/api/confess/$CSLUG"
expect 200 "confess read"
LID=$(jget id)
api "POST respond(yes)" POST "/api/confess/$CSLUG/respond" '{"response":"yes"}'
expect 200 "confess respond"
api "POST reply" POST "/api/confess/$CSLUG/reply" '{"reply":"Wah kaget, makasih ya — tes audit."}'
expect 200 "confess reply"
api "GET  status/[senderKey]" GET "/api/status/$CKEY"
expect 200 "confess status (sender view)"

echo "═══ 2. LETTERS: buat 3 surat → mulai → buka → balas ═══"
api "POST /api/letters" POST /api/letters \
  '{"fromName":"Audit","toName":"Tes Alur","theme":"matcha","letters":[{"title":"Hari 1","body":"Audit surat satu, abaikan.","unlockDays":0},{"title":"Hari 3","body":"Audit surat dua, abaikan.","unlockDays":3},{"title":"Hari 7","body":"Audit surat tiga, abaikan.","unlockDays":7}]}'
expect 201 "letters create"
LSLUG=$(jget slug); LKEY=$(jget senderKey)
api "GET  /api/letters/$LSLUG" GET "/api/letters/$LSLUG"
expect 200 "letters read"
LETTER_ID=$(python3 -c "
import json
d=json.load(open('/tmp/audit.json'))
def walk(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k in ('id','letterId') and isinstance(v,str) and len(v)>10: return v
            r=walk(v)
            if r: return r
    if isinstance(o,list):
        for v in o:
            r=walk(v)
            if r: return r
print(walk(d) or '')")
api "POST start" POST "/api/letters/$LSLUG/start"
expect 200 "letters start"
api "POST open" POST "/api/letters/$LSLUG/open" "{\"letterId\":\"$LETTER_ID\"}"
expect 200 "letters open (hari-0)"
api "POST reply surat" POST "/api/letters/$LSLUG/reply" "{\"letterId\":\"$LETTER_ID\",\"body\":\"Tes balasan audit, terima kasih.\"}"
expect 200 "letters reply"
api "GET  status/[senderKey] letters" GET "/api/status/$LKEY"
expect 200 "letters status (sender view)"

echo "═══ 3. GIFTS: buat cake → baca → tukar kupon ═══"
api "POST /api/gifts (cake)" POST /api/gifts \
  '{"type":"cake","fromName":"Audit","toName":"Tes Alur","theme":"rose","data":{"occasion":"ultah","message":"Audit kue digital, selamat ulang tahun!"}}'
expect 201 "gifts create"
GSLUG=$(jget slug); GKEY=$(jget senderKey)
api "GET  /api/gifts/$GSLUG" GET "/api/gifts/$GSLUG"
expect 200 "gifts read"
api "POST redeem kupon#0" POST "/api/gifts/$GSLUG/redeem" '{"index":0}'
expect 200 "gifts redeem"
api "GET  status/[senderKey] gifts" GET "/api/status/$GKEY"
expect 200 "gifts status (sender view)"

echo "═══ 4. KADO: anonim (senderName null) → status ═══"
api "POST /api/kado anonim+sidik" POST /api/kado \
  '{"targetName":"Zaraa","message":"Audit kado anonim dengan kunci sidik jari.","senderName":null,"isAnonymous":true,"kadoType":"fingerprint","kadoData":{"holdMs":1200}}'
expect 201 "kado create (regresi null-senderName)"
KADO_ID=$(jget data.id)
api "PATCH kado status=opened" PATCH "/api/kado/$KADO_ID/status" '{"status":"opened"}'
expect 200 "kado status update"
api "GET  /kado/$KADO_ID (halaman)" GET "/kado/$KADO_ID"
expect 200 "kado view page"

echo "═══ 5. READ publik: wall & stats ═══"
api "GET /api/wall" GET /api/wall
expect 200 "wall read"
api "GET /api/stats" GET /api/stats
expect 200 "stats read"

echo ""
echo "═══ RINGKASAN ═══"
say "LULUS" "$PASS"
say "GAGAL" "$FAIL"
say "LAMBAT (>3 dtk)" "$SLOW"
rm -f /tmp/audit.json /tmp/audit_code
