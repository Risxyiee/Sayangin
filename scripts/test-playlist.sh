#!/bin/bash
# E2E fitur Playlist Kita (kado digital tipe "playlist").
# Semua dalam SATU tool call — sandbox mematikan background process di akhir call.
set -u
cd /home/z/my-project
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (dapat $2, harap $3)"; fi; }

cleanup() {
  agent-browser close >/dev/null 2>&1
  pkill -f "next dev" >/dev/null 2>&1
}
trap cleanup EXIT

echo "=== [1] Start dev server (fresh, tanpa artefak build prod) ==="
pkill -f "next dev" >/dev/null 2>&1; pkill -f "next-server" >/dev/null 2>&1; sleep 1
rm -rf .next
nohup bun run dev > dev.log 2>&1 &
READY=0
for i in $(seq 1 75); do
  if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then READY=1; break; fi
  sleep 1
done
[ "$READY" = "1" ] && ok "server ready (${i}s)" || { bad "server tidak ready"; exit 1; }

echo "=== [2] API suite ==="
IPX() { curl -s -w "|%{http_code}" -H "x-forwarded-for: $1" "${@:2}"; }
CODE() { echo "${1##*|}"; }
BODY() { echo "${1%|*}"; }

# 2a. buat playlist valid → 201
S1_IP="198.18.0.1"
R=$(IPX $S1_IP -X POST localhost:3000/api/gifts -H 'Content-Type: application/json' -d '{
  "type":"playlist","fromName":"Uji Raka","toName":"Uji Nadia","theme":"rose",
  "data":{"title":"Lagu Buat Uji","message":"Ini lagu-lagu kenangan kita berdua ya, dengerin pelan-pelan.",
  "songs":[
    {"title":"Monolog","artist":"Pamungkas","note":"lagu first date","link":""},
    {"title":"Rumah Ke Rumah","artist":"Hindia","note":"spontan mampir","link":""},
    {"title":"Sial","artist":"Mahalini","note":"","link":"https://youtube.com/watch?v=abc123"}]}}')
check "POST playlist valid → 201" "$(CODE "$R")" "201"
S1=$(BODY "$R" | jq -r '.slug // empty')
K1=$(BODY "$R" | jq -r '.senderKey // empty')
[ -n "$S1" ] && ok "playlist dibuat slug=$S1" || { bad "gagal buat playlist: $R"; exit 1; }

# 2b. cuma 2 lagu → 400
R=$(IPX 198.18.0.2 -X POST localhost:3000/api/gifts -H 'Content-Type: application/json' -d '{
  "type":"playlist","toName":"Uji Dua","data":{"title":"Kurang Lagu","message":"pesan cukup panjang ya",
  "songs":[{"title":"A","artist":"","note":"","link":""},{"title":"B","artist":"","note":"","link":""}]}}')
check "playlist 2 lagu → 400" "$(CODE "$R")" "400"
BODY "$R" | jq -r '.error // empty' | rg -q "Minimal 3 lagu" && ok "pesan error minimal 3 lagu" || bad "pesan error salah: $R"

# 2c. lagu tanpa judul → 400
R=$(IPX 198.18.0.3 -X POST localhost:3000/api/gifts -H 'Content-Type: application/json' -d '{
  "type":"playlist","toName":"Uji Tiga","data":{"title":"Ada Kosong","message":"pesan cukup panjang ya",
  "songs":[{"title":"A","artist":"","note":"","link":""},{"title":"","artist":"","note":"","link":""},{"title":"C","artist":"","note":"","link":""}]}}')
check "lagu tanpa judul → 400" "$(CODE "$R")" "400"
BODY "$R" | jq -r '.error // empty' | rg -q "judul" && ok "pesan error judul kosong" || bad "pesan error salah: $R"

# 2d. link nggak valid → 400
R=$(IPX 198.18.0.4 -X POST localhost:3000/api/gifts -H 'Content-Type: application/json' -d '{
  "type":"playlist","toName":"Uji Empat","data":{"title":"Link Jebek","message":"pesan cukup panjang ya",
  "songs":[{"title":"A","artist":"","note":"","link":""},{"title":"B","artist":"","note":"","link":""},{"title":"C","artist":"","note":"","link":"bukan-url"}]}}')
check "link nggak valid → 400" "$(CODE "$R")" "400"
BODY "$R" | jq -r '.error // empty' | rg -q "Link lagunya" && ok "pesan error link" || bad "pesan error salah: $R"

# 2e. moderasi note lagu → 400
R=$(IPX 198.18.0.5 -X POST localhost:3000/api/gifts -H 'Content-Type: application/json' -d '{
  "type":"playlist","toName":"Uji Lima","data":{"title":"Kata Kotor","message":"pesan cukup panjang ya",
  "songs":[{"title":"A","artist":"","note":"","link":""},{"title":"B","artist":"","note":"","link":""},{"title":"C","artist":"anjing","note":"","link":""}]}}')
check "moderasi artist → 400" "$(CODE "$R")" "400"
BODY "$R" | jq -r '.error // empty' | rg -q "nggak boleh dipakai" && ok "pesan moderasi" || bad "pesan moderasi salah: $R"

# 2f. GET recipient → konten lengkap
R=$(curl -s -w "|%{http_code}" localhost:3000/api/gifts/$S1)
check "GET /api/gifts/[slug] → 200" "$(CODE "$R")" "200"
B=$(BODY "$R")
[ "$(echo "$B" | jq -r '.type')" = "playlist" ] && ok "type=playlist" || bad "type salah"
echo "$B" | rg -q "Monolog" && echo "$B" | rg -q "lagu first date" && ok "konten lagu + note ada" || bad "konten lagu hilang"
check "views tercatat (non-preview)" "$(echo "$B" | jq -r '.views')" "1"

# 2g. preview pakai senderKey → tidak nambah views
R=$(curl -s -w "|%{http_code}" "localhost:3000/api/gifts/$S1?p=$K1")
check "preview → 200" "$(CODE "$R")" "200"
B=$(BODY "$R")
[ "$(echo "$B" | jq -r '.preview')" = "true" ] && ok "preview=true" || bad "preview gagal"
check "preview tidak nambah views" "$(echo "$B" | jq -r '.views')" "1"

# 2h. metadata halaman penerima (OG) → judul personal
H=$(curl -s "localhost:3000/?k=$S1")
echo "$H" | rg -qi "ada playlist spesial buat uji nadia" && ok "metadata OG personal" || bad "metadata OG hilang"

# 2i. OG image → PNG
CT=$(curl -s -o /dev/null -w "%{content_type}" "localhost:3000/api/og?k=$S1")
[ "$CT" = "image/png" ] && ok "OG image PNG" || bad "OG content-type: $CT"

# 2j. status pengirim → playlist + jumlah lagu
R=$(curl -s -w "|%{http_code}" "localhost:3000/api/status/$K1")
check "GET status → 200" "$(CODE "$R")" "200"
B=$(BODY "$R")
[ "$(echo "$B" | jq -r '.giftType // empty')" = "playlist" ] && ok "giftType=playlist" || bad "giftType salah: $B"
[ "$(echo "$B" | jq -r '.plSongs // 0')" = "3" ] && ok "plSongs=3" || bad "plSongs salah: $(echo "$B" | jq -r '.plSongs')"
[ "$(echo "$B" | jq -r '.plTitle // empty')" = "Lagu Buat Uji" ] && ok "plTitle tersimpan" || bad "plTitle salah"

# 2k. rate limit: 5 per 15 menit per IP → permintaan ke-6 = 429
for j in 1 2 3 4 5 6; do
  CODE6=$(IPX 198.18.0.9 -X POST localhost:3000/api/gifts -H 'Content-Type: application/json' -d '{
    "type":"playlist","toName":"Rate","data":{"title":"RL","message":"pesan cukup panjang","songs":[{"title":"A"},{"title":"B"}]}}' | tail -c 3)
done
check "rate limit ke-6 → 429" "$CODE6" "429"

echo "=== [3] Browser E2E 390x844 ==="
agent-browser close >/dev/null 2>&1
agent-browser set viewport 390 844 >/dev/null 2>&1
agent-browser open "http://localhost:3000/#playlist" >/dev/null 2>&1
sleep 4
T=$(agent-browser eval "document.body.innerText")
echo "$T" | rg -qi "Judul playlistnya" && ok "form playlist kebuka via #playlist" || bad "form playlist nggak muncul"
SW=$(agent-browser eval "document.documentElement.scrollWidth")
[ "${SW:-999}" -le 391 ] && ok "landing 390px tanpa overflow (sw=$SW)" || bad "landing overflow sw=$SW"

agent-browser fill "#gs-from" "Uji Raka" >/dev/null 2>&1 && ok "isi nama pengirim" || bad "isi gs-from gagal"
agent-browser fill "#gs-to" "Uji Nadia" >/dev/null 2>&1 && ok "isi nama penerima" || bad "isi gs-to gagal"
agent-browser find text "Siapkan Playlist" click >/dev/null 2>&1 && ok "klik submit" || bad "tombol submit nggak ketemu"
sleep 3
T=$(agent-browser eval "document.body.innerText")
echo "$T" | rg -qi "Playlist kamu siap dikirim" && ok "hasil: playlist siap dikirim" || bad "hasil nggak muncul: $T" | head -c 300
echo "$T" | rg -q '\?k=[a-z0-9]' && ok "link kado tampil" || bad "link kado nggak tampil"
agent-browser screenshot /tmp/shot-pl-form.png >/dev/null 2>&1

# view penerima (pakai S1 dari API — sudah terverifikasi di DB)
agent-browser open "http://localhost:3000/?k=$S1&p=$K1" >/dev/null 2>&1
sleep 3
T=$(agent-browser eval "document.body.innerText")
echo "$T" | rg -qi "Buka Kadonya" && ok "intro amplop muncul" || bad "intro hilang"
agent-browser find text "Buka Kadonya" click >/dev/null 2>&1
sleep 2.5
T=$(agent-browser eval "document.body.innerText")
echo "$T" | rg -qi "Lagu Buat Uji" && ok "judul playlist tampil" || bad "judul playlist hilang"
echo "$T" | rg -q "Monolog" && echo "$T" | rg -q "Pamungkas" && ok "lagu 1 + artis tampil" || bad "lagu 1 hilang"
echo "$T" | rg -qi "lagu first date" && ok "catatan kenangan tampil" || bad "note hilang"
echo "$T" | rg -qi "Uji Raka" && ok "tanda tangan pengirim" || bad "pengirim hilang"
echo "$T" | rg -qi "tap lagunya" && ok "petunjuk tap lagu" || bad "petunjuk hilang"
YT=$(agent-browser eval 'JSON.stringify([!!document.querySelector("a[href*=\"youtube.com/results\"]"), !!document.querySelector("a[href*=\"youtube.com/watch\"]")])')
echo "$YT" | rg -q '\[true,true\]' && ok "link YT search + link custom" || bad "link lagu: $YT"
SW=$(agent-browser eval "document.documentElement.scrollWidth")
[ "${SW:-999}" -le 391 ] && ok "gift view 390px tanpa overflow (sw=$SW)" || bad "gift view overflow sw=$SW"
agent-browser screenshot /tmp/shot-pl-view.png >/dev/null 2>&1 && ok "screenshot gift view"

# halaman status pengirim
agent-browser open "http://localhost:3000/?s=$K1" >/dev/null 2>&1
sleep 3
T=$(agent-browser eval "document.body.innerText")
echo "$T" | rg -qi "3 lagu nunggu didengerin" && ok "status: jumlah lagu" || bad "status lagu hilang"
echo "$T" | rg -qi "Lagu Buat Uji" && ok "status: judul playlist" || bad "status judul hilang"
agent-browser screenshot /tmp/shot-pl-status.png >/dev/null 2>&1

echo "=== [4] dev.log scan ==="
if rg -n "⨯|Unhandled|failed to compile|PrismaClientValidationError|ECONNREFUSED" dev.log >/tmp/dl.err 2>/dev/null; then
  bad "ada error di dev.log:"; head -10 /tmp/dl.err
else
  ok "dev.log bersih"
fi

echo "=== [5] Cleanup data uji ==="
bun -e 'import {Database} from "bun:sqlite"; const db=new Database("db/custom.db"); const r=db.run("DELETE FROM Gift WHERE toName LIKE '"'"'Uji%'"'"' OR toName = '"'"'Rate'"'"'"); console.log("deleted:", r.changes); db.close();'
N=$(bun -e 'import {Database} from "bun:sqlite"; const db=new Database("db/custom.db"); console.log(db.query("SELECT COUNT(*) c FROM Gift WHERE toName LIKE '"'"'Uji%'"'"'").get().c); db.close();')
check "data uji terhapus" "$N" "0"

echo ""
echo "=============================="
echo "TOTAL: $PASS pass / $FAIL fail"
[ "$FAIL" = "0" ] && echo "🎉 SEMUA PASS" || echo "⚠️ ADA YANG GAGAL"
