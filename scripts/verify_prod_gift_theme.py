#!/usr/bin/env python3
"""
Verifikasi produksi fitur tema warna kado (semua tipe):
  1. create kado bouquet dengan kadoData.theme = "matcha"
  2. GET halaman /kado/<id> → HTML harus memuat glow matcha
     rgba(134,239,172,...) dari themes.ts (inline style, bukan class)
  3. kontrol: kado tanpa tema → fallback rose rgba(244,63,94,...)
Menunggu deploy Cloudflare dulu (pemilih tema di /create bundle).
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

def call(method, path, body=None, timeout=30, json_resp=True):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json", "User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if json_resp else txt)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt
    except Exception as e:
        return 0, str(e)

print("=== [0] Tunggu deploy: server harus merender glow tema (marker: kado matcha) ===")
ready = False
kid_probe = ""
for attempt in range(20):
    # create kado probe dengan theme matcha — API lama pun menerima kadoData
    # apa adanya; deploy selesai ditandai SERVER merender glow matcha.
    st, res = call("POST", "/api/kado", {
        "kadoType": "bouquet",
        "targetName": "Audit Tema",
        "message": "Probe deploy tema — abaikan.",
        "isAnonymous": True,
        "kadoData": {"theme": "matcha"},
    })
    kid_probe = (res.get("data") or {}).get("id", "") if isinstance(res, dict) else ""
    glow_live = False
    if kid_probe:
        st2, html2 = call("GET", f"/kado/{kid_probe}", json_resp=False)
        glow_live = st2 == 200 and "rgba(134,239,172" in (html2 or "")
    print(f"    percobaan {attempt+1}: kado matcha → glow matcha di server = {glow_live}")
    if glow_live:
        ok("server sudah merender tema kado (glow matcha tampil)")
        ready = True
        break
    time.sleep(15)
if not ready:
    bad("tema belum live di server — deploy belum selesai")
    print(f"HASIL: PASS={P} FAIL={F}")
    raise SystemExit(1)

print("=== [0b] Pemilih tema di bundle client /create ===")
st, html = call("GET", "/create", json_resp=False)
picker_live = False
if st == 200 and html:
    import re
    # pemilih bisa di chunk app/create ATAU chunk shared — cari di SEMUA chunk
    chunks = set(re.findall(r'/_next/static/chunks/[^"\']+?\.js', html))
    for c in list(chunks)[:12]:
        stc, js = call("GET", c, json_resp=False)
        if stc == 200 and "Tema Warna Kadonya" in (js or ""):
            picker_live = True
            break
if picker_live:
    ok("pemilih tema live di Creator Studio (bundle client)")
else:
    bad("pemilih tema belum terlihat di bundle /create")

print("=== [1] Create kado bouquet tema MATCHA ===")
st, res = call("POST", "/api/kado", {
    "kadoType": "bouquet",
    "targetName": "Audit Tema",
    "message": "Uji tema warna kado — pesan contoh untuk audit, abaikan ya.",
    "isAnonymous": True,
    "kadoData": {"theme": "matcha"},
})
kid = (res.get("data") or {}).get("id", "") if isinstance(res, dict) else ""
if st in (200, 201) and kid:
    ok(f"kado matcha terbentuk ({kid})")
else:
    bad(f"create kado gagal: HTTP {st} {str(res)[:150]}")
    print(f"HASIL: PASS={P} FAIL={F}")
    raise SystemExit(1)

print("=== [2] Halaman kado harus bersinar matcha ===")
st, html = call("GET", f"/kado/{kid}", json_resp=False)
if st == 200:
    if "rgba(134,239,172" in (html or ""):
        ok("glow matcha tampil di halaman kado (tema tersimpan & diterapkan)")
    else:
        bad("glow matcha TIDAK ada di halaman kado")
else:
    bad(f"GET halaman kado: HTTP {st}")

print("=== [3] Kontrol: kado tanpa tema → fallback rose ===")
st, res = call("POST", "/api/kado", {
    "kadoType": "bouquet",
    "targetName": "Audit Tema",
    "message": "Uji fallback tema — pesan contoh untuk audit, abaikan ya.",
    "isAnonymous": True,
    "kadoData": None,
})
kid2 = (res.get("data") or {}).get("id", "") if isinstance(res, dict) else ""
if st in (200, 201) and kid2:
    st2, html2 = call("GET", f"/kado/{kid2}", json_resp=False)
    if st2 == 200 and "rgba(244,63,94" in (html2 or ""):
        ok("kado tanpa tema jatuh ke rose (fallback aman)")
    else:
        bad(f"fallback rose tidak terlihat (HTTP {st2})")
else:
    bad(f"create kado kontrol gagal: HTTP {st}")

print(f"HASIL: PASS={P} FAIL={F}")
print("TEMA WARNA KADO SEHAT ✅" if F == 0 else "MASIH ADA MASALAH ❌")
