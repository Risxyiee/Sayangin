-- S-04: Rate limiter durable — counter fixed-window disimpan di Postgres
-- supaya restart/redeploy isolate Cloudflare tidak lagi me-reset hitungan.
--
-- Diterapkan lewat prisma migrate deploy, atau tempel langsung di
-- Supabase SQL Editor (Dashboard → SQL → New query → Run).
--
-- Catatan: tabel ini infrastruktur murni, TIDAK dimodelkan di schema.prisma
-- (diakses via raw SQL atomic upsert di src/lib/rate-limit.ts).

create table if not exists rate_limit (
  key          text primary key,                 -- "<aksi>:<ip>", mis. confess-create:1.2.3.4
  count        integer not null default 0,       -- jumlah hit dalam window aktif
  window_start timestamptz not null default now(), -- awal window aktif
  updated_at   timestamptz not null default now()
);

comment on table rate_limit is
  'S-04: rate limiter durable (fixed window). Diisi otomatis oleh src/lib/rate-limit.ts via atomic upsert; entri > 1 hari disapu otomatis.';
