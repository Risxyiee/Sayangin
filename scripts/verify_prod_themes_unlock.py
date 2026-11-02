#!/usr/bin/env python3
"""
Verifikasi produksi Kangenin (retry-aware):
  1. tema warna tersimpan & balik (matcha + sakura)
  2. jadwal buka: locked sampai waktunya → terbuka otomatis
     (plus cek ulang surat lama 3cqv86c4 yang waktunya sudah lewat)
  3. balasan penerima tampil di halaman pantau pengirim
Semua GET/POST diulang maks 3x untuk menyalakan DB dingin Hyperdrive.
"""
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

BASE = "https://kangenin.risyxieee123.workers.dev"

P = F = 0
def ok(msg):
    global P; P += 1; print(f"  PASS: {msg}")

def bad(msg):
    global F; F += 1; print(f"  FAIL: {msg}")

def call(method, path, body=None, tries=4):
    """Return (status, parsed_json_or_text). Retry utk error jaringan & 5xx/timeout."""
    last = None
    for i in range(tries):
        try:
            data = json.dumps(body).encode() if body is not None else None
            req = urllib.request.Request(
                BASE + path, data=data, method=method,
                headers={
                    "Content-Type": "application/json",
                    # Cloudflare WAF memblokir signature python-urllib (403/1010)
                    "User-Agent": ("Mozilla/5.0 (Linux; Android 13; Pixel 7) "
                                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                                   "Chrome/126.0.0.0 Mobile Safari/537.36"),
                } if data else {
                    "User-Agent": ("Mozilla/5.0 (Linux; Android 13; Pixel 7) "
                                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                                   "Chrome/126.0.0.0 Mobile Safari/537.36"),
                },
            )
            with urllib.request.urlopen(req, timeout=25) as r:
                txt = r.read().decode()
                return r.status, (json.loads(txt) if txt.startswith("{") or txt.startswith("[") else txt)
        except urllib.error.HTTPError as e:
            body_txt = e.read().decode()[:300]
            last = (e.code, body_txt)
            if e.code < 500:  # 4xx = jawaban sah dari API, jangan diulang
                return last
        except Exception as e:  # timeout, koneksi — coba lagi (DB dingin)
            last = (0, f"{type(e).__name__}: {e}")
        if i < tries - 1:
            time.sleep(4 * (i + 1))
    return last

print("=== [A] Surat lama 3cqv86c4 (dibuat 75 dtk sebelumnya, waktunya sudah lewat) ===")
st, d = call("GET", "/api/confess/3cqv86c4")
if isinstance(d, dict):
    if "locked" in d:
        bad(f"masih locked?! {d.get('locked')}")
    elif d.get("theme") == "matcha" and d.get("message"):
        ok("surat lama TERBUKA otomatis setelah waktunya lewat ✓ (tema matcha, isi tampil)")
    else:
        bad(f"bentuk tak terduga: {json.dumps(d)[:200]}")
else:
    bad(f"GET gagal: {st} {d}")

print("=== [B] Buat confess SAKURA tanpa jadwal ===")
st, d = call("POST", "/api/confess", {
    "fromName": "Raka", "toName": "Uji Tema",
    "message": "Tes tema sakura tanpa jadwal buka.",
    "theme": "sakura", "isPublic": False,
})
slug2 = (d or {}).get("slug") if isinstance(d, dict) else None
if slug2:
    ok(f"confess sakura terbentuk ({slug2})")
else:
    bad(f"create gagal: {st} {d}")
st, d = call("GET", f"/api/confess/{slug2}")
if isinstance(d, dict) and d.get("theme") == "sakura" and "locked" not in d and d.get("message"):
    ok("tema sakura tersimpan & langsung terbuka (tanpa jadwal) ✓")
else:
    bad(f"GET sakura: {st} {json.dumps(d)[:200] if isinstance(d,dict) else d}")

print("=== [C] Buat confess MATCHA + unlockAt +70 dtk ===")
unlock = (datetime.now(timezone.utc) + timedelta(seconds=70)).isoformat().replace("+00:00", "Z")
st, d = call("POST", "/api/confess", {
    "fromName": "", "toName": "Uji Jadwal 2",
    "message": "Tes terkunci 70 detik, lalu terbuka sendiri.",
    "theme": "matcha", "isPublic": False, "unlockAt": unlock,
})
slug3 = (d or {}).get("slug") if isinstance(d, dict) else None
skey3 = (d or {}).get("senderKey") if isinstance(d, dict) else None
if slug3 and skey3:
    ok(f"confess matcha terjadwal terbentuk ({slug3})")
else:
    bad(f"create gagal: {st} {d}")

st, d = call("GET", f"/api/confess/{slug3}")
if isinstance(d, dict) and d.get("locked") is True and d.get("theme") == "matcha" and "message" not in d:
    ok("sebelum waktunya: locked=true, tema matcha, isi TIDAK bocor ✓")
else:
    bad(f"GET locked: {st} {json.dumps(d)[:200] if isinstance(d,dict) else d}")

print("=== [D] Nunggu 75 dtk → terbuka otomatis ===")
time.sleep(75)
st, d = call("GET", f"/api/confess/{slug3}")
if isinstance(d, dict) and "locked" not in d and d.get("message") and d.get("theme") == "matcha":
    ok("setelah waktunya: terbuka otomatis, isi + tema tampil ✓")
else:
    bad(f"GET unlocked: {st} {json.dumps(d)[:200] if isinstance(d,dict) else d}")

print("=== [E] Jawab + balas → cek dashboard pengirim ===")
st, d = call("POST", f"/api/confess/{slug3}/respond", {"response": "yes"})
if isinstance(d, dict) and d.get("response") == "yes":
    ok("respond yes tersimpan")
else:
    bad(f"respond: {st} {d}")
st, d = call("POST", f"/api/confess/{slug3}/reply", {"reply": "aku juga... makasih udah berani bilang"})
if isinstance(d, dict) and "makasih" in (d.get("reply") or ""):
    ok("balasan tertulis tersimpan")
else:
    bad(f"reply: {st} {d}")

seen = None
for attempt in range(4):
    st, d = call("GET", f"/api/status/{skey3}", tries=2)
    if isinstance(d, dict) and d.get("type") == "confess":
        # bentuk respons: field confession bisa di level atas (produksi) atau nested
        c = d.get("confession") or d
        seen = (c.get("reply"), c.get("response"))
        if seen[0] and seen[1] == "yes":
            break
    time.sleep(5)
if seen and seen[0] and seen[1] == "yes":
    ok(f"halaman pantau pengirim menampilkan balasan + jawaban ✓ ({seen})")
else:
    bad(f"status belum benar: {st} {json.dumps(d)[:200] if isinstance(d,dict) else d}")

print()
print(f"HASIL: PASS={P} FAIL={F}")
print("SEMUA BUKTI ✅" if F == 0 else "ADA YANG GAGAL ❌")
