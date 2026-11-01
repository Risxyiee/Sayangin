-- S-05: Monitoring error produksi — log error terstruktur di DB.
--
-- Diterapkan lewat prisma migrate deploy, atau tempel langsung di
-- Supabase SQL Editor (Dashboard → SQL → New query → Run).
--
-- Diisi otomatis oleh reportError() (src/lib/monitor.ts) dari semua
-- catch block API routes. Lihat error terbaru:
--   select route, message, created_at from error_log order by created_at desc limit 50;
-- Entri lebih tua dari 30 hari disapu otomatis (2% peluang per insert).

create table if not exists error_log (
  id         bigserial primary key,
  route      text not null,              -- mis. "POST /api/confess"
  message    text not null,              -- describeError: nama | pesan | kode
  stack      text,
  created_at timestamptz not null default now()
);

create index if not exists error_log_created_at_idx on error_log (created_at desc);

comment on table error_log is
  'S-05: monitoring error produksi (self-hosted). Diisi reportError(); retensi 30 hari.';
