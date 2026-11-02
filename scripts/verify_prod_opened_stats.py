#!/usr/bin/env python3
"""
Verifikasi produksi fitur statistik buka kado:
  1. create kado (confess) via /api/kado
  2. POST /api/kado/<id>/opened dua kali (simulasi dua sesi browser)
  3. GET /api/kado/<id>/reply (endpoint dashboard) harus memuat
     openCount=2 + lastOpenedAt ISO
Menunggu deploy Cloudflare selesai (POST opened sebelumnya bisa 404).
"""
import json
import time
import urllib.request
import urllib.error

BASE = "https://kangenin.risyxieee123.workers.dev"
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36")

P = F = 0
def ok(m): global P; P += 1; print(f"  PASS: {m}")
def bad(m): global F; F += 1; print(f"  FAIL: {m}")

def call(method, path, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json", "User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt[:1] in "{[" else txt)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt
    except Exception as e:
        return 0, str(e)

print("=== [0] Tunggu deploy (endpoint /opened hidup = 404 'Kado nggak ketemu' utk UUID dummy) ===")
ready = False
for attempt in range(20):
    st, res = call("POST", "/api/kado/00000000-0000-0000-0000-000000000000/opened", {})
    body = res if isinstance(res, dict) else {}
    print(f"    percobaan {attempt+1}: POST opened dummy → HTTP {st} {str(res)[:80]}")
    # 400  = ID sampah ditolak validasi      → endpoint hidup
    # 404  + "Kado nggak ketemu" (JSON API)  → endpoint hidup, UUID dummy tak ada di DB
    # 404  + halaman HTML                    → deploy belum selesai (route lama)
    if st == 400:
        ok("endpoint /opened hidup — ID sampah ditolak 400")
        ready = True
        break
    if st == 404 and body.get("error") == "Kado nggak ketemu":
        ok("endpoint /opened hidup (UUID dummy 404 dari API, bukan halaman lama)")
        ready = True
        break
    time.sleep(15)
if not ready:
    bad("endpoint /opened tidak kunjung hidup — deploy belum selesai")
    print(f"HASIL: PASS={P} FAIL={F}")
    raise SystemExit(1)

print("=== [1] Create kado uji ===")
st, res = call("POST", "/api/kado", {
    "kadoType": "confess",
    "targetName": "Audit Stats",
    "message": "Uji statistik buka — pesan contoh untuk audit, abaikan ya.",
    "isAnonymous": True,
    "kadoData": {"theme": "rose"},
})
kid = (res.get("data") or {}).get("id", "") if isinstance(res, dict) else ""
if st in (200, 201) and kid:
    ok(f"kado terbentuk ({kid})")
else:
    bad(f"create kado gagal: HTTP {st} {str(res)[:150]}")
    print(f"HASIL: PASS={P} FAIL={F}")
    raise SystemExit(1)

print("=== [2] POST opened dua kali ===")
counts = []
for i in range(2):
    st, res = call("POST", f"/api/kado/{kid}/opened", {})
    n = res.get("openCount") if isinstance(res, dict) else None
    counts.append(n)
    if st == 200 and n == i + 1:
        ok(f"opened #{i+1} → openCount={n}")
    else:
        bad(f"opened #{i+1}: HTTP {st} {str(res)[:150]}")

print("=== [3] GET dashboard reply memuat statistik ===")
st, res = call("GET", f"/api/kado/{kid}/reply")
if st == 200 and isinstance(res, dict):
    oc, lo = res.get("openCount"), res.get("lastOpenedAt")
    if oc == 2:
        ok("dashboard melihat openCount=2 (dua sesi tercatat atomik)")
    else:
        bad(f"openCount salah: {oc}")
    if isinstance(lo, str) and len(lo) > 10:
        ok(f"lastOpenedAt tercatat: {lo}")
    else:
        bad(f"lastOpenedAt salah: {lo}")
else:
    bad(f"GET reply: HTTP {st} {str(res)[:150]}")

print(f"HASIL: PASS={P} FAIL={F}")
print("STATISTIK BUKA KADO SEHAT ✅" if F == 0 else "MASIH ADA MASALAH ❌")
