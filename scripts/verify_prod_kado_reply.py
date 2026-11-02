#!/usr/bin/env python3
"""
Uji loop balasan KADO di produksi (fitur yang tadinya 500 karena kolom progress):
  create kado (confess) → PATCH status accepted → POST reply → GET reply
Menunggu deploy Cloudflare selesai (coba sampai POST reply tidak lagi 500).
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
        return e.code, e.read().decode()[:250]
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"

print("=== Buat kado uji (confess) ===")
st, d = call("POST", "/api/kado", {
    "targetName": "Uji Reply Kado",
    "message": "Tes loop balasan kado di produksi.",
    "senderName": "Tester",
    "isAnonymous": True,
    "kadoType": "confess",
    "kadoData": {},
})
kado_id = (d or {}).get("data", {}).get("id") if isinstance(d, dict) else None
if kado_id:
    ok(f"kado terbentuk ({kado_id})")
else:
    bad(f"create gagal: {st} {d}"); raise SystemExit(1)

print("=== PATCH status → accepted ===")
st, d = call("PATCH", f"/api/kado/{kado_id}/status", {"status": "accepted"})
if isinstance(d, dict) and d.get("success") and d.get("status") == "accepted":
    ok("status accepted")
else:
    bad(f"patch gagal: {st} {d}")

print("=== POST balasan (sebelumnya 500 karena kolom progress) ===")
reply_ok = False
for attempt in range(6):  # tunggu deploy Cloudflare masuk (build ±2-5 mnt)
    st, d = call("POST", f"/api/kado/{kado_id}/reply", {"reply": "wah, makasih ya udah kirim ini 🤍"})
    if st == 200 and isinstance(d, dict) and d.get("success"):
        ok(f"balasan kado TERSIMPAN (percobaan ke-{attempt + 1}) — deploy baru sudah live ✓")
        reply_ok = True
        break
    print(f"  … percobaan {attempt + 1}: HTTP {st} — deploy belum masuk / DB dingin, tunggu 60 dtk")
    time.sleep(60)
if not reply_ok:
    bad(f"reply masih gagal: {st} {d}")

print("=== GET balasan (dashboard pengirim) — HARUS segar in_seconds ===")
if reply_ok:
    fresh = False
    for attempt in range(6):
        st, d = call("GET", f"/api/kado/{kado_id}/reply")
        if (isinstance(d, dict) and d.get("success") and "makasih" in (d.get("reply") or "")
                and d.get("status") == "accepted"):
            ok(f"dashboard membaca balasan SEGERA setelah dikirim ✓ (tunggu {attempt * 3} dtk)")
            fresh = True
            break
        time.sleep(3)
    if not fresh:
        bad(f"balasan tidak terbaca segar (cache basi?): {st} {d}")

print()
print(f"HASIL: PASS={P} FAIL={F}")
print("LOOP BALASAN KADO SEHAT ✅" if F == 0 else "MASIH ADA MASALAH ❌")
