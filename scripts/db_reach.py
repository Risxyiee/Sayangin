#!/usr/bin/env python3
"""Tes bertahap koneksi Supabase dari sandbox (tanpa membocorkan kredensial).
Langkah: DNS → TCP → TLS → PostgreSQL query. Laporkan di mana macetnya."""
import os, socket, ssl, sys, time, urllib.parse

url = ""
with open("/home/z/my-project/.env") as f:
    for line in f:
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip()
u = urllib.parse.urlparse(url)
host, port = u.hostname, u.port or 5432
print(f"host={host}:{port} db={u.path.lstrip('/')} user={u.username}")

print("1) DNS lookup...", end=" ", flush=True)
try:
    infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    ips = sorted({i[4][0] for i in infos})
    print("OK:", ", ".join(ips[:4]))
except Exception as e:
    print(f"GAGAL: {type(e).__name__}: {e}"); sys.exit(1)

print("2) TCP connect (10s)...", end=" ", flush=True)
t0 = time.time()
try:
    s = socket.create_connection((host, port), timeout=10)
    print(f"OK ({time.time()-t0:.2f}s)")
except Exception as e:
    print(f"GAGAL: {type(e).__name__}: {e}"); sys.exit(1)

print("3) TLS handshake (10s)...", end=" ", flush=True)
try:
    ctx = ssl.create_default_context()
    ss = ctx.wrap_socket(s, server_hostname=host)
    print(f"OK TLSv{ss.version()}")
except Exception as e:
    print(f"GAGAL: {type(e).__name__}: {str(e)[:100]}"); sys.exit(1)

print("4) PostgreSQL startup+query (15s)...", end=" ", flush=True)
ss.settimeout(15)
try:
    import psycopg  # type: ignore
    conn = psycopg.connect(url, connect_timeout=15)
    cur = conn.execute("select 1")
    cur.fetchone()
    print("OK — DB hidup & kredensial valid")
    conn.close()
except ImportError:
    # fallback pg (node) kalau psycopg tidak ada
    os.system(
        "node -e \"const {Client}=require('pg');require('dotenv').config({path:'/home/z/my-project/.env'});"
        "const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},"
        "connectionTimeoutMillis:15000});"
        "c.connect().then(()=>c.query('select 1 as ok')).then(r=>{console.log('OK —',JSON.stringify(r.rows[0]));return c.end();})"
        ".catch(e=>{console.log('GAGAL:',e.code||'',JSON.stringify(String(e.message||e)).slice(0,160));process.exit(0);})\""
    )
except Exception as e:
    print(f"GAGAL: {type(e).__name__}: {str(e)[:160]}")
