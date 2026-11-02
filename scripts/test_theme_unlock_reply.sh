#!/bin/bash
# Bukti nyata fitur yang diragukan user — diuji LANGSUNG KE PRODUKSI (tanpa arg)
# atau ke dev server lokal (arg 1 = BASE, arg 2 = 1 buat start server lokal):
#   1. tema warna template   → tersimpan & balik di GET (matcha + sakura)
#   2. jadwal buka (besok/… )→ surat BENAR-BENAR terkunci sampai waktunya,
#                              lalu terbuka otomatis (diuji dgn unlockAt 75 dtk)
#   3. balasan penerima      → POST reply, tampil di halaman status pengirim
# Semua dalam SATU call karena sandbox mematikan proses background di akhir call.
set -u
cd /home/z/my-project
BASE="${1:-https://kangenin.risyxieee123.workers.dev}"
START_SERVER="${2:-0}"
echo "Target uji: $BASE"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
jqget() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

cleanup() {
  [ "$START_SERVER" = "1" ] && pkill -f "next dev" >/dev/null 2>&1
  true
}
trap cleanup EXIT

echo "=== [1] Server ==="
if [ "$START_SERVER" = "1" ]; then
  nohup bun run dev > /dev/null 2>&1 &
  READY=0
  for i in $(seq 1 90); do
    if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then READY=1; break; fi
    sleep 1
  done
  [ "$READY" = "1" ] && ok "server ready (${i}s)" || { bad "server tidak ready"; exit 1; }
else
  curl -s -o /dev/null --max-time 10 "$BASE/" && ok "produksi merespons" || { bad "produksi tidak merespons"; exit 1; }
fi

echo "=== [2] Buat confess matcha + unlockAt 75 dtk ==="
UNLOCK_AT=$(python3 -c "from datetime import datetime,timedelta,timezone;print((datetime.now(timezone.utc)+timedelta(seconds=75)).isoformat().replace('+00:00','Z'))")
R=$(curl -s --max-time 20 -X POST "$BASE/api/confess" -H 'Content-Type: application/json' \
  -d "{\"fromName\":\"\",\"toName\":\"Uji Jadwal\",\"message\":\"Tes kunci terjadwal: surat ini harusnya masih terkunci sekarang.\",\"theme\":\"matcha\",\"isPublic\":false,\"unlockAt\":\"$UNLOCK_AT\"}")
SLUG1=$(echo "$R" | jqget "['slug']")
SKEY1=$(echo "$R" | jqget "['senderKey']")
[ -n "$SLUG1" ] && ok "confess matcha terbentuk (slug $SLUG1)" || { bad "gagal buat confess: $R"; exit 1; }

echo "=== [3] GET sebelum waktunya → harus locked ==="
G=$(curl -s --max-time 20 "$BASE/api/confess/$SLUG1")
LOCKED=$(echo "$G" | jqget "['locked']")
UAT=$(echo "$G" | jqget "['unlockAt']")
THEME1=$(echo "$G" | jqget "['theme']")
MSG_LEAK=$(echo "$G" | jqget "['message']")
[ "$LOCKED" = "True" ] && ok "locked=true saat belum waktunya" || bad "locked=$LOCKED (harus True)"
[ -n "$UAT" ] && [ "$UAT" != "None" ] && ok "unlockAt dikirim ($UAT)" || bad "unlockAt kosong"
[ "$THEME1" = "matcha" ] && ok "theme=matcha tersimpan & balik di API" || bad "theme=$THEME1"
{ [ "$MSG_LEAK" = "None" ] || [ -z "$MSG_LEAK" ]; } && ok "isi surat TIDAK bocor saat terkunci" || bad "BOCOR: message=$MSG_LEAK"

echo "=== [4] Buat confess sakura tanpa jadwal → langsung terbuka ==="
R2=$(curl -s --max-time 20 -X POST "$BASE/api/confess" -H 'Content-Type: application/json' \
  -d "{\"fromName\":\"Raka\",\"toName\":\"Uji Tema\",\"message\":\"Tes tema sakura tanpa jadwal.\",\"theme\":\"sakura\",\"isPublic\":false}")
SLUG2=$(echo "$R2" | jqget "['slug']")
G2=$(curl -s --max-time 20 "$BASE/api/confess/$SLUG2")
THEME2=$(echo "$G2" | jqget "['theme']")
LOCKED2=$(echo "$G2" | jqget "['locked']")
[ "$THEME2" = "sakura" ] && ok "theme=sakura tersimpan" || bad "theme2=$THEME2"
[ "$LOCKED2" = "False" ] && ok "tanpa jadwal → tidak terkunci" || bad "locked2=$LOCKED2"

echo "=== [5] Nunggu unlock (75 dtk) ==="
sleep 80
G3=$(curl -s --max-time 20 "$BASE/api/confess/$SLUG1")
LOCKED3=$(echo "$G3" | jqget "['locked']")
MSG3=$(echo "$G3" | jqget "['message']")
THEME3=$(echo "$G3" | jqget "['theme']")
[ "$LOCKED3" = "False" ] && ok "setelah waktunya → locked hilang (terbuka otomatis)" || bad "locked3=$LOCKED3 (masih terkunci!)"
{ [ "$MSG3" != "None" ] && [ -n "$MSG3" ]; } && ok "isi surat tampil setelah buka" || bad "message kosong setelah unlock"
[ "$THEME3" = "matcha" ] && ok "theme tetap matcha" || bad "theme3=$THEME3"

echo "=== [6] Penerima jawab + tulis balasan ==="
RS=$(curl -s --max-time 20 -X POST "$BASE/api/confess/$SLUG1/respond" -H 'Content-Type: application/json' -d '{"response":"yes"}')
echo "$RS" | jqget "['response']" | grep -q "yes" && ok "respond=yes tersimpan" || bad "respond gagal: $RS"
RR=$(curl -s --max-time 20 -X POST "$BASE/api/confess/$SLUG1/reply" -H 'Content-Type: application/json' -d '{"reply":"aku juga... makasih udah berani bilang"}')
echo "$RR" | jqget "['reply']" | grep -q "makasih" && ok "reply tersimpan" || bad "reply gagal: $RR"

echo "=== [7] Dashboard pengirim (GET /api/status) lihat balasan ==="
ST=$(curl -s --max-time 20 "$BASE/api/status/$SKEY1")
SREPLY=$(echo "$ST" | jqget "['confession']['reply']")
SRESP=$(echo "$ST" | jqget "['confession']['response']")
[ "$SREPLY" != "None" ] && [ -n "$SREPLY" ] && ok "balasan MUNCUL di halaman pantau pengirim" || bad "reply tidak muncul di status: $ST"
[ "$SRESP" = "yes" ] && ok "jawaban yes terlihat di pantauan" || bad "response=$SRESP"

echo "=== [8] Bersih-bersih ==="
if [ "$START_SERVER" = "1" ]; then
  bun scripts/cleanup_confess_slug.ts "$SLUG1" "$SLUG2"
else
  echo "(produksi: baris uji dibiarkan — tanpa kredensial DB di sandbox; isPublic=false, tak tampil di dinding)"
fi

echo ""
echo "================================"
echo "HASIL: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "SEMUA BUkti ✅" || echo "ADA YANG GAGAL ❌"
