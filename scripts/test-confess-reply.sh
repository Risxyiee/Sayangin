#!/bin/bash
# E2E fitur balasan confess — semua dalam SATU call karena sandbox
# mematikan proses background di akhir setiap tool call.
set -u
cd /home/z/my-project
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check() { # $1 desc, $2 got, $3 want
  if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (dapat $2, harap $3)"; fi
}

cleanup() {
  agent-browser close >/dev/null 2>&1
  pkill -f "next dev" >/dev/null 2>&1
}
trap cleanup EXIT

echo "=== [1] Start dev server ==="
nohup bun run dev > dev.log 2>&1 &
READY=0
for i in $(seq 1 60); do
  if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then READY=1; break; fi
  sleep 1
done
[ "$READY" = "1" ] && ok "server ready (${i}s)" || { bad "server tidak ready"; exit 1; }

echo "=== [2] API suite ==="
# buat confess baru
R=$(curl -s -X POST localhost:3000/api/confess -H 'Content-Type: application/json' \
  -d '{"toName":"Uji Balas","fromName":"Tester","message":"Hai, ini surat buat coba fitur balasan ya."}')
S=$(echo "$R" | python3 -c "import json,sys;print(json.load(sys.stdin).get('slug',''))")
K=$(echo "$R" | python3 -c "import json,sys;print(json.load(sys.stdin).get('senderKey',''))")
[ -n "$S" ] && ok "confess dibuat slug=$S" || { bad "gagal buat confess: $R"; exit 1; }

C() { curl -s -w "|%{http_code}" "$@"; }
CODE() { echo "${1##*|}"; }

# 2a. reply sebelum jawab → 403
RESP=$(C -X POST localhost:3000/api/confess/$S/reply -H 'Content-Type: application/json' -d '{"reply":"aku juga suka kamu"}')
check "reply sebelum jawab → 403" "$(CODE "$RESP")" "403"

# 2b. respond later
RESP=$(C -X POST localhost:3000/api/confess/$S/respond -H 'Content-Type: application/json' -d '{"response":"later"}')
check "respond later → 200" "$(CODE "$RESP")" "200"

# 2c. reply valid → 200
RESP=$(C -X POST localhost:3000/api/confess/$S/reply -H 'Content-Type: application/json' -d '{"reply":"Aku butuh waktu, tapi makasih udah berani bilang 🥲"}')
check "reply valid → 200" "$(CODE "$RESP")" "200"
echo "$RESP" | rg -q '"ok":true' && ok "reply JSON ok=true" || bad "reply JSON tanpa ok=true"

# 2d. reply kedua kali → 400 (one-shot)
RESP=$(C -X POST localhost:3000/api/confess/$S/reply -H 'Content-Type: application/json' -d '{"reply":"bales lagi dong"}')
check "reply kedua kali → 400" "$(CODE "$RESP")" "400"

# 2e. moderasi → 400 (pakai confess kedua biar tidak tersentuh one-shot di atas)
R2=$(curl -s -X POST localhost:3000/api/confess -H 'Content-Type: application/json' \
  -d '{"toName":"Uji Dua","fromName":"","message":"Surat kedua buat tes moderasi balasan."}')
S2=$(echo "$R2" | python3 -c "import json,sys;print(json.load(sys.stdin).get('slug',''))")
K2=$(echo "$R2" | python3 -c "import json,sys;print(json.load(sys.stdin).get('senderKey',''))")
curl -s -o /dev/null -X POST localhost:3000/api/confess/$S2/respond -H 'Content-Type: application/json' -d '{"response":"yes"}'
RESP=$(C -X POST localhost:3000/api/confess/$S2/reply -H 'Content-Type: application/json' -d '{"reply":"anjiiiir gila sih"}')
check "reply kata terlarang → 400" "$(CODE "$RESP")" "400"

# confess segar khusus browser E2E (belum dijawab apa pun)
R3=$(curl -s -X POST localhost:3000/api/confess -H 'Content-Type: application/json' \
  -d '{"toName":"Uji Browser","fromName":"Rahasia","message":"Kalau kamu baca ini, aku mau bilang sesuatu yang penting."}')
S3=$(echo "$R3" | python3 -c "import json,sys;print(json.load(sys.stdin).get('slug',''))")
K3=$(echo "$R3" | python3 -c "import json,sys;print(json.load(sys.stdin).get('senderKey',''))")
[ -n "$S3" ] && ok "confess browser dibuat slug=$S3" || { bad "gagal buat confess browser"; exit 1; }

# 2f. status pengirim menampilkan response+reply
ST=$(curl -s localhost:3000/api/status/$K)
echo "$ST" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['type']=='confess', d
assert d['response']=='later', d
assert 'makasih udah berani' in (d.get('reply') or ''), d
assert d.get('repliedAt'), d
print('status confession lengkap: response/reply/repliedAt')
" && ok "status API expose balasan" || bad "status API balasan"

# 2g. penerima buka ulang → response+reply ikut
CV=$(curl -s "localhost:3000/api/confess/$S")
echo "$CV" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['response']=='later' and 'makasih' in (d.get('reply') or ''), d
print('GET confess mengembalikan response+reply')
" && ok "GET confess expose balasan" || bad "GET confess balasan"

# 2h. ubah jawaban later→yes (endpoint respond overwrite), reply tetap utuh
curl -s -o /dev/null -X POST localhost:3000/api/confess/$S/respond -H 'Content-Type: application/json' -d '{"response":"yes"}'
ST=$(curl -s localhost:3000/api/status/$K)
echo "$ST" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['response']=='yes' and 'makasih' in (d.get('reply') or ''), d
print('jawaban berubah yes, balasan tetap tersimpan')
" && ok "ubah jawaban tidak menghapus balasan" || bad "ubah jawaban merusak balasan"

echo "=== [3] Browser E2E (390x844, confess segar: $S3) ==="
agent-browser set viewport 390 844 >/dev/null
agent-browser open "http://localhost:3000/?k=$S3" --timeout 20000 >/dev/null
agent-browser wait --load networkidle --timeout 20000 >/dev/null || true
sleep 1
agent-browser find text "Buka Suratnya" click >/dev/null 2>&1 || true
sleep 4 # tunggu mesin ketik selesai
agent-browser find text "Iya, aku juga suka kamu" click >/dev/null 2>&1
sleep 2
agent-browser find text "Tulis balasan buat dia" click >/dev/null 2>&1
sleep 1
agent-browser find first "textarea" fill "Wah kaget tapi seneng banget. Aku juga suka kamu 😳💗" >/dev/null 2>&1
agent-browser find text "kirim balasan" click >/dev/null 2>&1
sleep 2.5
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -qi "balasanmu terkirim" && ok "composer kirim balasan → box terkirim muncul" || bad "box terkirim tidak muncul"
echo "$TXT" | rg -q "Wah kaget tapi seneng banget" && ok "box menampilkan isi balasan" || bad "isi balasan tidak tampil di box"
OW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null || echo "?")
check "tanpa overflow horizontal (confess view)" "$OW" "390"

# buka ulang → langsung layar jawaban + box terkirim (tanpa ditanya ulang)
agent-browser reload >/dev/null 2>&1
sleep 4
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -qi "balasanmu terkirim" && ok "buka ulang: box balasan tetap tampil" || bad "buka ulang: box balasan hilang"
echo "$TXT" | rg -q "gimana jawabanmu" && bad "buka ulang masih menanyakan jawaban" || ok "buka ulang tidak menanyakan ulang jawaban"

# halaman pantauan pengirim
agent-browser open "http://localhost:3000/?s=$K3" --timeout 20000 >/dev/null
sleep 3
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -q "Ada balasan dari dia" && ok "status: step 'Ada balasan dari dia!' muncul" || bad "status tak menampilkan balasan"
echo "$TXT" | rg -q "Wah kaget tapi seneng banget" && ok "status: isi balasan tampil" || bad "status: isi balasan tidak tampil"
SW=$(agent-browser eval "document.documentElement.scrollWidth" 2>/dev/null || echo "?")
check "tanpa overflow horizontal (status view)" "$SW" "390"
agent-browser screenshot /tmp/render/e2e-status-balasan.png >/dev/null 2>&1 || true

echo "=== [4] Selesai server, cek error runtime ==="
pkill -f "next dev" >/dev/null 2>&1; sleep 2
if rg -n "⨯|Unhandled|ReferenceError|TypeError|PrismaClient" dev.log | rg -v "DeprecationWarning" >/dev/null; then
  bad "ada error di dev.log:"; rg -n "⨯|Unhandled|ReferenceError|TypeError|PrismaClient" dev.log | head -5
else
  ok "dev.log bersih dari error runtime"
fi

echo "=== [5] Cleanup data tes ==="
python3 - <<'PY'
import sqlite3
con = sqlite3.connect("db/custom.db")
n1 = con.execute("DELETE FROM Confession WHERE toName LIKE 'Uji%' OR toName IN ('Diagnosa','Debugg')").rowcount
con.commit(); con.close()
print(f"dihapus {n1} confess tes")
PY

echo ""
echo "===== HASIL: $PASS pass, $FAIL fail ====="
[ "$FAIL" = "0" ]
