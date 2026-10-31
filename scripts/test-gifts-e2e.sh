#!/bin/bash
# E2E 4 kartu kado (bouquet/photobox/cake/coupons) — SATU call penuh.
set -u
cd /home/z/my-project
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (dapat $2, harap $3)"; fi; }
TXT=""

cleanup() { agent-browser close >/dev/null 2>&1; pkill -f "next dev" >/dev/null 2>&1; }
trap cleanup EXIT

echo "=== [1] Start dev server ==="
nohup bun run dev > dev.log 2>&1 &
READY=0
for i in $(seq 1 60); do
  if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then READY=1; break; fi
  sleep 1
done
[ "$READY" = "1" ] && ok "server ready (${i}s)" || { bad "server tidak ready"; exit 1; }

echo "=== [2] API suite: bikin 4 tipe kado ==="
mkdir -p /tmp/gifts
python3 - <<'PY'
import json, base64, urllib.request

def post(path, payload):
    req = urllib.request.Request("http://localhost:3000" + path,
        data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
gifts = {
    "bouquet": {"type":"bouquet","toName":"Uji Buket","fromName":"Raka","data":{"card":"Selamat anniversary sayang, bunganya buat kamu 🌷","flowers":["rose","tulip","sunflower"]}},
    "photobox": {"type":"photobox","toName":"Uji Foto","fromName":"","data":{"caption":"kita berdua 🤍","note":"simpan ya fotonya","photos":[png,png,png]}},
    "cake": {"type":"cake","toName":"Uji Kue","fromName":"Dimas","data":{"occasion":"ultah","message":"Barakallah di ulang tahunmu yang ke-20, doaku selalu untukmu 🎂"}},
    "coupons": {"type":"coupons","toName":"Uji Kupon","fromName":"","data":{"coupons":[{"title":"1x Pelukan Gratis","desc":"berlaku selamanya"},{"title":"1x Nonton Pilihanmu","desc":"aku yang bayar"},{"title":"1x Sarapan Dibawain","desc":"pagi hari"}]}},
}
out = {}
for name, payload in gifts.items():
    st, d = post("/api/gifts", payload)
    print(f"CREATE {name}: {st} slug={d.get('slug')}")
    out[name] = {"slug": d.get("slug", ""), "senderKey": d.get("senderKey", "")}
json.dump(out, open("/tmp/gifts/slugs.json", "w"))
PY
S_BUK=$(python3 -c "import json;print(json.load(open('/tmp/gifts/slugs.json'))['bouquet']['slug'])")
S_FOTO=$(python3 -c "import json;print(json.load(open('/tmp/gifts/slugs.json'))['photobox']['slug'])")
S_KUE=$(python3 -c "import json;print(json.load(open('/tmp/gifts/slugs.json'))['cake']['slug'])")
S_KUPON=$(python3 -c "import json;print(json.load(open('/tmp/gifts/slugs.json'))['coupons']['slug'])")
K_KUPON=$(python3 -c "import json;print(json.load(open('/tmp/gifts/slugs.json'))['coupons']['senderKey'])")
[ -n "$S_BUK" ] && [ -n "$S_FOTO" ] && [ -n "$S_KUE" ] && [ -n "$S_KUPON" ] && ok "4 kado dibuat: $S_BUK $S_FOTO $S_KUE $S_KUPON" || { bad "gagal buat kado"; exit 1; }

echo "=== [3] API: GET, redeem, status, OG ==="
for S in $S_BUK $S_FOTO $S_KUE $S_KUPON; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/gifts/$S")
  check "GET /api/gifts/$S → 200" "$CODE" "200"
done
# redeem kupon #0 → ok; #0 lagi → 400; redeem di kado non-kupon → 400
R=$(curl -s -X POST "http://localhost:3000/api/gifts/$S_KUPON/redeem" -H 'Content-Type: application/json' -d '{"index":0}')
echo "$R" | rg -q '"ok":true' && ok "redeem kupon #0 → ok" || bad "redeem #0 gagal: $R"
R=$(curl -s -X POST "http://localhost:3000/api/gifts/$S_KUPON/redeem" -H 'Content-Type: application/json' -d '{"index":0}')
echo "$R" | rg -q 'udah pernah dipakai' && ok "redeem #0 kedua kali → 400" || bad "double redeem tidak ditolak: $R"
R=$(curl -s -X POST "http://localhost:3000/api/gifts/$S_BUK/redeem" -H 'Content-Type: application/json' -d '{"index":0}')
echo "$R" | rg -q 'bukan kupon' && ok "redeem di buket → ditolak" || bad "redeem buket tidak ditolak: $R"
# status API kupon: daftar kupon + redeemed
ST=$(curl -s "http://localhost:3000/api/status/$K_KUPON")
echo "$ST" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d['type']=='gift' and d['giftType']=='coupons', d
assert len(d['coupons'])==3, d
assert '0' in d['redeemed'], d
print('status kupon: coupons + redeemed lengkap')
" && ok "status API expose kupon+redeemed" || bad "status API kupon salah"
# OG title per tipe
OG=$(curl -s "http://localhost:3000/?k=$S_BUK" | rg -o 'property="og:title" content="[^"]*"')
echo "$OG" | rg -q "buket bunga" && ok "OG title buket benar" || bad "OG buket salah: $OG"

echo "=== [4] Browser: 4 halaman kado (390x844) ==="
agent-browser set viewport 390 844 >/dev/null
agent-browser open "http://localhost:3000/?k=$S_BUK" >/dev/null 2>&1; sleep 3
agent-browser find text "Buka Kadonya" click >/dev/null 2>&1; sleep 2.5
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -q "Buket buat kamu" && ok "buket: judul tampil" || bad "buket: judul tidak tampil"
echo "$TXT" | rg -q "Selamat anniversary" && ok "buket: kartu ucapaan tampil" || bad "buket: kartu tidak tampil"
check "buket: tanpa overflow" "$(agent-browser eval 'document.documentElement.scrollWidth' 2>/dev/null || echo '?')" "390"

agent-browser open "http://localhost:3000/?k=$S_KUE" >/dev/null 2>&1; sleep 3
agent-browser find text "Buka Kadonya" click >/dev/null 2>&1; sleep 2.5
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -q "pejamkan mata" && ok "kue: layar permintaan tampil" || bad "kue: layar permintaan tidak tampil"
echo "$TXT" | rg -q "Tiup lilinnya" && ok "kue: tombol tiup tampil" || bad "kue: tombol tiup tidak tampil"
agent-browser eval "[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Tiup lilinnya'))?.click(); 'x'" >/dev/null 2>&1; sleep 1.5
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -qi "yeay.*permintaan" && ok "kue: tiup memicu efek" || bad "kue: tiup tidak bereaksi"
echo "$TXT" | rg -q "Barakallah" && ok "kue: pesan muncul setelah tiup" || bad "kue: pesan tidak muncul"
check "kue: tanpa overflow" "$(agent-browser eval 'document.documentElement.scrollWidth' 2>/dev/null || echo '?')" "390"

agent-browser open "http://localhost:3000/?k=$S_FOTO" >/dev/null 2>&1; sleep 3
agent-browser find text "Buka Kadonya" click >/dev/null 2>&1; sleep 2.5
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -q "kita berdua" && ok "photobox: caption tampil" || bad "photobox: caption tidak tampil"
echo "$TXT" | rg -q "tekan-tahan" && ok "photobox: petunjuk simpan tampil" || bad "photobox: petunjuk tidak tampil"
check "photobox: tanpa overflow" "$(agent-browser eval 'document.documentElement.scrollWidth' 2>/dev/null || echo '?')" "390"

agent-browser open "http://localhost:3000/?k=$S_KUPON" >/dev/null 2>&1; sleep 3
agent-browser find text "Buka Kadonya" click >/dev/null 2>&1; sleep 2.5
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -q "Pelukan Gratis" && ok "kupon: daftar kupon tampil" || bad "kupon: daftar tidak tampil"
agent-browser eval "[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Pakai kupon'))?.click(); 'x'" >/dev/null 2>&1; sleep 1
agent-browser eval "[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Yakin, pakai'))?.click(); 'x'" >/dev/null 2>&1; sleep 1.5
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -q "2 dari 3 kupon sudah dipakai" && ok "kupon: redeem via UI tercatat (#0 udah dipakai via API)" || bad "kupon: redeem UI gagal"
check "kupon: tanpa overflow" "$(agent-browser eval 'document.documentElement.scrollWidth' 2>/dev/null || echo '?')" "390"
agent-browser screenshot /tmp/render/e2e-kupon.png >/dev/null 2>&1 || true

echo "=== [5] Browser: GiftStudio form bouquet (UI create) ==="
agent-browser open "http://localhost:3000/#buket" >/dev/null 2>&1; sleep 4
agent-browser find first "#gs-to" fill "Uji Studio" >/dev/null 2>&1
agent-browser find first "#gs-card" fill "Dari form studio: bunga untukmu yang di Ujung Berung." >/dev/null 2>&1
agent-browser find text "Siapkan Buket" click >/dev/null 2>&1
sleep 3
TXT=$(agent-browser eval "document.body.innerText" 2>/dev/null || true)
echo "$TXT" | rg -q "kamu siap dikirim" && ok "studio: form bouquet berhasil → panel link" || bad "studio: form gagal: $(echo "$TXT" | rg -o 'error[^"]*' | head -1)"

echo "=== [6] Error runtime + cleanup ==="
pkill -f "next dev" >/dev/null 2>&1; sleep 2
if rg -n "⨯|Unhandled|ReferenceError|TypeError|PrismaClient" dev.log | rg -v DeprecationWarning >/dev/null; then
  bad "error di dev.log:"; rg -n "⨯|Unhandled|ReferenceError|TypeError|PrismaClient" dev.log | head -5
else
  ok "dev.log bersih"
fi
python3 - <<'PY'
import sqlite3
con = sqlite3.connect("db/custom.db")
n = con.execute("DELETE FROM Gift WHERE toName LIKE 'Uji %'").rowcount
con.commit(); con.close()
print(f"dihapus {n} gift tes")
PY

echo ""
echo "===== HASIL: $PASS pass, $FAIL fail ====="
[ "$FAIL" = "0" ]
