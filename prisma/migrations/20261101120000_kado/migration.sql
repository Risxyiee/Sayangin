-- Kado: fondasi fleksibel untuk semua variasi fitur buka-kado (JSONB).
-- Konfigurasi interaksi per kadoType disimpan di kadoData (jsonb), jadi
-- menambah tipe kado baru TIDAK perlu mengubah schema — cukup value kadoType baru.
--
-- Diterapkan lewat prisma migrate deploy, atau tempel langsung di
-- Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- id diisi oleh Prisma client (uuid v4) saat insert.

create table if not exists "Kado" (
  id             uuid not null,
  "targetName"   text not null,
  "message"      text not null,
  "senderName"   text,
  "fomoInitials" text,
  "kadoType"     text not null,
  "kadoData"     jsonb,
  "status"       text not null default 'pending',
  "createdAt"    timestamp(3) not null default current_timestamp,

  constraint "Kado_pkey" primary key ("id")
);

create index if not exists "Kado_status_createdAt_idx"
  on "Kado" ("status", "createdAt" desc);
create index if not exists "Kado_kadoType_idx"
  on "Kado" ("kadoType");

comment on table "Kado" is
  'Kado fleksibel: kadoType + kadoData (jsonb) menampung variasi interaksi buka-kado tanpa migrasi schema. fomoInitials dibuat oleh src/utils/fomoLogic.ts.';
