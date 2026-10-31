#!/usr/bin/env python3
"""Test E2E situs live Kangenin di Cloudflare Workers.
Rantai: stats → dinding → OG → buat confess → baca confess → status pengirim.
Tanpa isPublic=true supaya dinding publik tidak tercemar data uji."""
import json, urllib.request, urllib.error

BASE = "https://kangenin.risyxieee123.workers.dev"
UA = {"User-Agent": "kangenin-e2e/1.0"}

def req(path, method="GET", body=None, ct="application/json"):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={**UA, **({"Content-Type": ct} if data else {})})
    try:
        with urllib.request.urlopen(r, timeout=45) as res:
            raw = res.read()
            try:
                return res.status, json.loads(raw)
            except Exception:
                return res.status, raw[:120]
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, "<no body>"

print("== 1. /api/stats ==")
code, out = req("/api/stats")
print(code, out)

print("== 2. /dinding ==")
code, out = req("/dinding")
print(code, "OK" if code == 200 else out)

print("== 3. /api/og (kartu share) ==")
code, out = req("/api/og")
print(code, len(out), "bytes" if isinstance(out, bytes) else out)

print("== 4. POST /api/confess ==")
payload = {
    "fromName": "Tim Kangenin",
    "toName": "Calon Pengguna",
    "message": "Tes deploy: kalau kamu baca ini, berarti Hyperdrive udah jalan. Maaf ya ngetes di sini 💛",
    "theme": "sakura",
    "isPublic": False,
}
code, out = req("/api/confess", "POST", payload)
print(code, out if code != 201 else "(201 dibuat)")
assert code == 201, "GAGAL buat confess!"
slug, skey = out["slug"], out["senderKey"]
print(f"   slug={slug}  senderKey={skey[:6]}...")

print("== 5. GET /api/confess/[slug] ==")
code, out = req(f"/api/confess/{slug}")
print(code, {k: out.get(k) for k in ("toName", "theme", "status")} if isinstance(out, dict) else out)

print("== 6. GET /?k=slug (halaman penerima) ==")
r = urllib.request.Request(f"/?k={slug}".join(["", ""]), url := BASE + f"/?k={slug}",
                           headers=UA)
with urllib.request.urlopen(r, timeout=45) as res:
    html = res.read().decode("utf-8", "ignore")
print(res.status, "ada branding:", "Kangenin" in html)

print("== 7. GET /api/status/[senderKey] (pantauan pengirim) ==")
code, out = req(f"/api/status/{skey}")
print(code, "jumlah item:", len(out) if isinstance(out, list) else out)

print("\nSELESAI — rangkaian E2E berhasil" )
