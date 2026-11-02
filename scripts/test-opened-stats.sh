#!/bin/bash
# E2E fitur statistik buka kado: create → POST opened ×2 → GET reply
# harus memuat openCount=2 + lastOpenedAt. Satu tool call, server dipatikan di akhir.
set -u
cd /home/z/my-project
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

cleanup() { pkill -f "next dev" >/dev/null 2>&1; pkill -f "next-server" >/dev/null 2>&1; }
trap cleanup EXIT

pkill -f "next dev" >/dev/null 2>&1; pkill -f "next-server" >/dev/null 2>&1; sleep 1
nohup bun run dev > /tmp/dev-opened.log 2>&1 &
READY=0
for i in $(seq 1 75); do
  if curl -s -o /dev/null --max-time 2 http://localhost:3000/api; then READY=1; break; fi
  sleep 1
done
[ "$READY" = "1" ] && echo "server ready (${i}s)" || { echo "server GAGAL ready"; exit 1; }

# 1. create kado confess
C=$(curl -s -X POST http://localhost:3000/api/kado -H "Content-Type: application/json" -H "x-forwarded-for: 10.9.0.71" -d '{
  "kadoType":"confess","targetName":"Tes Buka","message":"Uji statistik buka — pesan contoh.","senderName":null,"isAnonymous":true,
  "kadoData":{"theme":"rose"}}')
ID=$(echo "$C" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null)
if [ -n "$ID" ]; then ok "kado terbentuk ($ID)"; else bad "kado gagal terbentuk: $(echo $C | head -c 200)"; exit 1; fi

# 2. POST opened dua kali (simulasi dua sesi)
O1=$(curl -s -X POST "http://localhost:3000/api/kado/$ID/opened" -H "x-forwarded-for: 10.9.0.72")
N1=$(echo "$O1" | python3 -c "import json,sys; print(json.load(sys.stdin).get('openCount',''))" 2>/dev/null)
[ "$N1" = "1" ] && ok "POST opened #1 → openCount=1" || bad "opened #1: $O1"

O2=$(curl -s -X POST "http://localhost:3000/api/kado/$ID/opened" -H "x-forwarded-for: 10.9.0.73")
N2=$(echo "$O2" | python3 -c "import json,sys; print(json.load(sys.stdin).get('openCount',''))" 2>/dev/null)
[ "$N2" = "2" ] && ok "POST opened #2 → openCount=2 (atomik)" || bad "opened #2: $O2"

# 3. GET dashboard reply → harus bawa openCount + lastOpenedAt
G=$(curl -s "http://localhost:3000/api/kado/$ID/reply" -H "x-forwarded-for: 10.9.0.74")
echo "$G" | python3 -c "
import json,sys
d=json.load(sys.stdin)
oc=d.get('openCount'); lo=d.get('lastOpenedAt')
assert oc==2, f'openCount salah: {oc}'
assert isinstance(lo,str) and len(lo)>10, f'lastOpenedAt salah: {lo}'
print(f'  PASS: GET reply memuat openCount=2 + lastOpenedAt={lo}')
" && PASS=$((PASS+1)) || { bad "GET reply: $G"; FAIL=$((FAIL+1)); }

# 4. ID sampah → 400
B=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:3000/api/kado/bukan-uuid/opened" -H "x-forwarded-for: 10.9.0.75")
[ "$B" = "400" ] && ok "ID sampah ditolak 400" || bad "ID sampah: HTTP $B"

echo "─── HASIL: PASS=$PASS FAIL=$FAIL ───"
[ "$FAIL" = "0" ]
