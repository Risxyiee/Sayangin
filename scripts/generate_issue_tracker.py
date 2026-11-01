#!/usr/bin/env python3
"""
Issue Tracker & Urutan Kerja — Sayangin
3 sheet: Issue Tracker | Urutan Kerja | Keputusan Infra
Gaya: palet 'warm' (sesuai vibe Sayangin), design system xlsx skill.
"""
import sys, os

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)

import base
base.use_palette_explicit("warm")
from base import (
    FONT_NAME, HEADER_BOLD, PRIMARY, SECONDARY, NEUTRAL_600, NEUTRAL_900,
    ACCENT_POSITIVE, ACCENT_WARNING,
    font_body, font_caption, font_subheader,
    setup_sheet, style_header_row, style_data_row, style_total_row,
)
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.properties import PageSetupProperties


def print_fit(ws, title_rows=None):
    """Landscape + muat 1 halaman lebar (fitToPage WAJIB True biar fitToWidth hidup)."""
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    if title_rows:
        ws.print_title_rows = title_rows

OUT = "/home/z/my-project/download/Issue_Tracker_Sayangin.xlsx"

wb = Workbook()

# ============================================================
# SHEET 1 — ISSUE TRACKER
# ============================================================
ws = wb.active
ws.title = "Issue Tracker"

HEAD1 = ["ID", "Prioritas", "Fase", "Kategori", "Judul",
         "Masalah (bukti di kode)", "Solusi", "Est. (hari)", "Kriteria Selesai", "Status"]
LAST1 = len(HEAD1) + 1  # ends at col K (11)

ISSUES = [
    ["S-01", "P0", "0 — Fondasi", "Keamanan",
     "Slug & senderKey pakai Math.random()",
     "makeToken()/makeSlug() di src/app/api/confess/route.ts memakai Math.random() — bukan CSPRNG; senderKey adalah satu-satunya kunci panel pantauan",
     "Ganti ke crypto.getRandomValues() (atau node:crypto randomBytes); panjang slug 8-10 char alphabet 31",
     0.25,
     "grep Math.random() di jalur token/slug = 0 hasil; link lama tetap valid (backward compatible)"],

    ["S-02", "P0", "0 — Fondasi", "Infrastruktur",
     "Workflow DB berbahaya untuk produksi",
     "package.json punya \"db:push\": \"prisma db push --accept-data-loss\" — sekali lupa = data user hilang",
     "Hapus script berbahaya; pakai prisma migrate dev (dev) + prisma migrate deploy (produksi); commit folder migrations",
     0.25,
     "npm run db:migrate jalan; tidak ada lagi --accept-data-loss di package.json"],

    ["S-03", "P0", "0 — Fondasi", "Infrastruktur",
     "Keputusan deploy: Cloudflare + Supabase ✅ (diputuskan 31 Okt)",
     "SQLite file + rate-limit in-memory tidak survivable di serverless/restart; app baru jalan di localhost",
     "PILIHAN USER: Cloudflare (Pages/Workers via @opennextjs/cloudflare, nodejs_compat) + Supabase Postgres. Migrasi: provider Prisma sqlite → postgresql, koneksi via pooler (port 6543), prisma migrate dari nol",
     1.0,
     "App hidup di domain produksi dengan DB persisten; satu deploy penuh sukses dari repo"],

    ["S-04", "P0", "0 — Fondasi", "Infrastruktur",
     "Rate limiter reset tiap restart",
     "src/lib/rate-limit.ts pakai Map per-proses — limit gugur saat restart/deploy, bisa di-bypass spam",
     "SELESAI 1 Nov: counter durable di Postgres — tabel rate_limit + atomic upsert (1 query) via pool pg bersama; tanpa akun/dep baru; fallback in-memory + backoff. Upstash cukup ditukar di file ini kalau traffic membesar",
     0.5,
     "Restart/redeploy → counter limit tidak reset; ujung-ke-ujung: spam 6x confess kena 429"],

    ["S-05", "P0", "0 — Fondasi", "Infrastruktur",
     "Nol backup, nol error monitoring",
     "DB berisi surat yang emosional tapi tidak ada backup; error produksi tidak terpantau (tidak ada Sentry)",
     "SELESAI 1 Nov: GitHub Actions pg_dump mingguan (retensi 90 hari) + restore drill otomatis di tiap backup; monitoring = log Cloudflare (observability) + tabel error_log di Supabase via reportError() di semua API. Sentry ditunda — SDK Next.js belum stabil untuk OpenNext",
     0.5,
     "Workflow backup hijau + drill restore sukses; error test tercatat di error_log & log Cloudflare"],

    ["S-06", "P1", "1 — Trust & Safety", "Moderasi",
     "Tidak ada halaman admin / antrean moderasi",
     "Moderasi hanya keyword filter + reportCount >= 3 otomatis hide — tidak ada UI review, tidak ada notifikasi laporan; konten toxic tetap live sampai 3 orang kebetulan lapor",
     "/admin dengan login password env (bcrypt + session): daftar konten terlapor, tombol hide/unhide/hapus, stats ringkas (konten aktif, laporan/bulan)",
     2.0,
     "Lapor konten 3x → muncul di /admin → aksi hide/unhide/hapus berfungsi; tanpa password tidak bisa masuk"],

    ["S-07", "P1", "1 — Trust & Safety", "Legal",
     "Tidak ada halaman legal",
     "Produk konten anonim tanpa /privacy, /terms, /kontak — rentan soal UU PDP No. 27/2022 & takedown",
     "3 halaman statis: Privasi (data apa yang disimpan, berapa lama), Ketentuan (larangan konten ofensif, hak moderasi), Kontak/Lapor (email + mekanisme takedown); link di footer",
     0.5,
     "Footer mengarah ke 3 halaman; isinya menjelaskan retensi data & cara minta hapus"],

    ["S-08", "P1", "1 — Trust & Safety", "Privasi",
     "Konten hidup selamanya (tanpa expiry)",
     "Schema tidak punya kolom expiresAt; confession & kado tersimpan dan bisa dibuka tanpa batas waktu",
     "Tambah kolom expiresAt (default 180 hari sejak dibuat); saat dibuka setelah expiry → halaman 'surat sudah tidak tersedia' (pesan lembut); purge fisik via cron bulanan",
     0.75,
     "Confession usia > 180 hari menampilkan halaman expired; data di DB masih ada sampai purge"],

    ["S-09", "P2", "2 — Retention", "Produk",
     "senderKey hilang = surat hilang permanen",
     "Key hanya ditampilkan sekali di layar sukses; salah tutup tab → tidak ada recovery sama sekali",
     "Tombol 'Simpan link ke WhatsApp saya' (wa.me send-to-self dengan teks jadi) + tombol copy; opsional kirim email via Resend",
     0.5,
     "Dari layar sukses, link + senderKey bisa dikirim ke chat sendiri via WA dan ditempel ulang dengan sukses"],

    ["S-10", "P2", "2 — Retention", "Produk",
     "Momen terpenting tidak dinotifikasi",
     "Pengirim harus buka halaman pantauan manual untuk tahu crush-nya sudah baca/membalas — momen emosional terkuat terbuang",
     "Minta email opsional (checkbox, alasan jelas) saat membuat confess; email via Resend saat openedAt & reply terisi; link unsubscribe di tiap email",
     1.5,
     "Buka link confess → email 'dibaca' masuk < 1 menit; balasan → email kedua; unsubscribe berfungsi"],

    ["S-11", "P2", "2 — Retention", "Growth",
     "Tidak ada analytics — funnel tak terukur",
     "Tidak ada gtag/posthog/umami di layout; hanya kolom views di DB; PRD menetapkan metrik tapi tidak terukur",
     "Pasang Umami (self-host, jalur A) atau Plausible/PostHog cloud; event: page_view, confess_created, link_opened, replied, gift_redeemed",
     0.5,
     "Dashboard analytics menampilkan funnel dasar; event test muncul real-time"],

    ["S-12", "P3 — ditunda", "Nanti — setelah fase percobaan", "Revenue",
     "Payment QRIS ditunda sampai fase percobaan validasi ✅ (keputusan 31 Okt)",
     "Fase sekarang = uji minat pasar; semua kado gratis. Copy sudah diganti jadi 'gratis selama masa uji' (Pricing, FAQ, Hero, metadata)",
     "Kalau nanti sinyal bagus: Midtrans Snap (QRIS friendly) — order per kado, webhook verifikasi, flag isPaid + paidAt di model Gift; kado terkunci sampai terbayar",
     2.5,
     "Alur sandbox Midtrans: bayar → webhook → kado terbuka; signature invalid ditolak"],

    ["S-13", "P1", "Merata — 4 fase", "Kualitas",
     "Nol test, nol CI",
     "Tidak ada file *.test.* di repo; API kritis (confess, reply, redeem) tidak terlindungi regresi",
     "Vitest untuk lib kritis (moderation, rate-limit, token, gift-data) + Playwright e2e 3 jalur: buat confess → buka → balas; GitHub Actions lint+test tiap push",
     1.5,
     "npm test hijau; Actions merah kalau ada regresi di jalur confess"],

    ["S-14", "P3", "3 — Monetisasi", "Kualitas",
     "Dependencies bloat",
     "30+ paket @radix-ui/* + @mdxeditor + @dnd-kit untuk app tanpa CMS/editor — besar kemungkinan banyak tak terpakai",
     "Jalankan knip/depcheck → hapus tak terpakai → ukur ukuran bundle sebelum vs sesudah",
     0.5,
     "npm run build sukses; First Load JS turun terukur (catat angkanya di PR)"],

    ["S-15", "P3", "3 — Monetisasi", "Kualitas",
     "A11y belum pernah diaudit",
     "Tidak pernah lulus audit; warning hydration Radix accordion (dev) masih ada",
     "Audit Lighthouse a11y di 4 halaman utama; perbaiki temuan mayor; cek kontras tema midnight/sunset; coba tracking issue accordion",
     0.5,
     "Skor a11y >= 90 di landing + halaman kado; 0 temuan mayor di axe"],
]

setup_sheet(ws, title="Issue Tracker — Sayangin (15 isu, siap dieksekusi)", last_col=LAST1)

# status pengerjaan (update tiap ada isu yang selesai)
STATUS = {"S-01": "Selesai", "S-02": "Selesai", "S-03": "Selesai", "S-04": "Selesai", "S-05": "Berjalan"}

# subtitle
ws.cell(row=3, column=2, value="Hasil audit kode 31 Okt 2026 · update 1 Nov 2026: S-01–S-05 rampung (Milestone 1 'Aman dipromosikan') · urutan eksekusi di sheet 'Urutan Kerja'").font = font_caption()

for c, h in enumerate(HEAD1, 2):
    ws.cell(row=4, column=c, value=h)
style_header_row(ws, 4, 2, LAST1)

DATA_START = 5
for i, row in enumerate(ISSUES):
    r = DATA_START + i
    for c, v in enumerate(row, 2):
        ws.cell(row=r, column=c, value=v)
    style_data_row(ws, r, 2, LAST1, i)
    # biarkan Excel auto-fit tinggi baris (teks panjang wrap)
    ws.row_dimensions[r].height = None
    # (alignment diset setelah style_data_row di blok format di atas)
    # format — semua sel rata atas biar baris tinggi tetap rapi
    ws.cell(row=r, column=2).font = Font(name=FONT_NAME, size=11, bold=HEADER_BOLD, color=PRIMARY)
    est = ws.cell(row=r, column=9)
    est.number_format = "0.0#"
    est.alignment = Alignment(horizontal="right", vertical="top")
    for col in (5, 6, 7, 10):  # teks panjang wrap
        ws.cell(row=r, column=col).alignment = Alignment(
            horizontal="left", vertical="top", wrap_text=True)
    for col in (2, 3, 4, 11):
        ws.cell(row=r, column=col).alignment = Alignment(
            horizontal="center", vertical="top")
    ws.cell(row=r, column=8).alignment = Alignment(
        horizontal="left", vertical="top", wrap_text=True)
    # kolom Status (K)
    ws.cell(row=r, column=11, value=STATUS.get(row[0], "Belum mulai"))
    # "≈ 2,5–3 minggu..." hanya di baris total, bukan data

DATA_END = DATA_START + len(ISSUES) - 1
TOTAL1 = DATA_END + 1
ws.cell(row=TOTAL1, column=2, value="Total")
ws.cell(row=TOTAL1, column=8, value="≈ 2,5–3 minggu kerja (sambil kuliah)")
tot = ws.cell(row=TOTAL1, column=9, value=f"=SUM(I{DATA_START}:I{DATA_END})")
style_total_row(ws, TOTAL1, 2, LAST1)
tot.number_format = "0.0#"
tot.alignment = Alignment(horizontal="right", vertical="center")

# lebar kolom manual (teks panjang)
W1 = {2: 7, 3: 10, 4: 15, 5: 13, 6: 24, 7: 36, 8: 36, 9: 8, 10: 32, 11: 12}
for c, w in W1.items():
    ws.column_dimensions[get_column_letter(c)].width = w

# CF kolom Status (K): Selesai → hijau, Berjalan → amber
rng = f"K{DATA_START}:K{DATA_END}"
ws.conditional_formatting.add(rng, FormulaRule(
    formula=[f'$K{DATA_START}="Selesai"'],
    fill=PatternFill("solid", fgColor="E8F5E9"),
    font=Font(name=FONT_NAME, color=ACCENT_POSITIVE)))
ws.conditional_formatting.add(rng, FormulaRule(
    formula=[f'$K{DATA_START}="Berjalan"'],
    fill=PatternFill("solid", fgColor="FEF9E7"),
    font=Font(name=FONT_NAME, color=ACCENT_WARNING)))

# catatan kaki
note_r = TOTAL1 + 2
ws.cell(row=note_r, column=2,
        value="Catatan: Est. (hari) = 1 hari kerja fokus (6–8 jam). Status di-update manual: Belum mulai → Berjalan → Selesai.").font = font_caption()
ws.freeze_panes = "C5"
print_fit(ws, "4:4")

# ============================================================
# SHEET 2 — URUTAN KERJA
# ============================================================
ws2 = wb.create_sheet("Urutan Kerja")
HEAD2 = ["No", "Hari", "Issue", "Pekerjaan", "Hasil / Milestone", "Tergantung pada"]
LAST2 = len(HEAD2) + 1  # col G (7)

# (no, hari, issue, pekerjaan, hasil, dep, is_milestone_label)
STEPS = [
    [1, "1", "S-01", "Ganti Math.random() → crypto.getRandomValues() untuk slug & senderKey", "Quick win keamanan (15 menit)", "—"],
    [2, "1", "S-02", "Bersihkan script DB, aktifkan prisma migrate + folder migrations", "Migrasi skema tidak lagi merusak data", "—"],
    [3, "1–2", "S-03", "Setup Cloudflare (adapter OpenNext) + Supabase Postgres + domain — keputusan final 31 Okt", "GERBANG 1 — app hidup di produksi", "S-02"],
    [4, "3", "S-04", "Rate limiter pindah ke Upstash Redis (atau Durable Objects)", "Anti-spam survivable restart", "S-03"],
    [5, "3", "S-05", "Pasang backup otomatis + Sentry; uji restore 1x", "Bencana = recoverable", "S-03"],
    ["", "", "", "MILESTONE 1 — AMAN DIPROMOSIKAN: boleh sebar link ke publik", "", ""],
    [6, "4–5", "S-06", "Bangun /admin: login password, daftar laporan, hide/unhide/hapus", "Moderasi manusia aktif", "S-03"],
    [7, "5", "S-07", "Halaman Privasi + Ketentuan + Kontak, link di footer", "Kepatuhan dasar UU PDP", "—"],
    [8, "6", "S-08", "Kolom expiresAt (180 hari) + halaman 'surat kedaluwarsa'", "Data tidak abadi", "S-03"],
    ["", "", "", "MILESTONE 2 — TRUST & SAFETY SIAP: produk layak dipercaya", "", ""],
    [9, "7", "S-09", "Recovery senderKey via WhatsApp send-to-self + tombol copy", "Tidak ada lagi surat hilang", "—"],
    [10, "8–9", "S-10", "Email opsional + notifikasi 'dibaca/dibalas' via Resend", "Momen emosional sampai ke pengirim", "S-03, S-05"],
    [11, "9", "S-11", "Analytics + event funnel (created → opened → replied)", "Data pertama masuk dashboard", "S-03"],
    ["", "", "", "MILESTONE 3 — LOOP RETENTION HIDUP: bisa ukur & balik ke user", "", ""],
    [12, "10", "S-13", "Vitest (lib kritis) + Playwright 3 jalur + GitHub Actions", "Regresi kena tangkal di CI", "—"],
    [13, "11–13", "S-12", "Midtrans Snap + webhook verifikasi + flag isPaid kado", "GERBANG 2 — kado bisa dijual (QRIS)", "S-11"],
    [14, "14", "S-14", "Deps cleanup (knip) + ukur bundle sebelum/sesudah", "Bundle lebih ramping", "—"],
    [15, "14", "S-15", "Audit a11y Lighthouse 4 halaman + pola kecil", "Skor a11y >= 90", "—"],
    ["", "", "", "MILESTONE 4 — PRODUK LENGKAP: siap monetisasi & pertumbuhan", "", ""],
]

setup_sheet(ws2, title="Urutan Kerja Konkret — 14 hari kerja, 4 milestone", last_col=LAST2)
ws2.cell(row=3, column=2, value="Aturan: satu milestone harus tuntas sebelum yang berikutnya; S-13 (test) diselipkan tiap fase, bukan diblok di akhir").font = font_caption()

for c, h in enumerate(HEAD2, 2):
    ws2.cell(row=4, column=c, value=h)
style_header_row(ws2, 4, 2, LAST2)

r = 5
di = 0
for row in STEPS:
    is_ms = row[3].startswith("MILESTONE")
    if is_ms:
        for c in range(2, LAST2 + 1):
            cell = ws2.cell(row=r, column=c)
            cell.fill = PatternFill("solid", fgColor=SECONDARY)
            cell.font = Font(name=FONT_NAME, size=11, bold=HEADER_BOLD, color=PRIMARY)
        ws2.cell(row=r, column=2, value=row[3])
        ws2.cell(row=r, column=2).alignment = Alignment(horizontal="left", vertical="center")
        ws2.row_dimensions[r].height = 24
        # merge label milestone ke lebar tabel
        ws2.merge_cells(start_row=r, start_column=2, end_row=r, end_column=LAST2)
    else:
        for c, v in enumerate(row, 2):
            ws2.cell(row=r, column=c, value=v)
        style_data_row(ws2, r, 2, LAST2, di)
        di += 1
        # auto-fit tinggi baris (teks pekerjaan bisa 2-3 baris)
        ws2.row_dimensions[r].height = None
        ws2.cell(row=r, column=2).font = Font(name=FONT_NAME, size=11, bold=HEADER_BOLD, color=PRIMARY)
        for col in (5,):
            ws2.cell(row=r, column=col).alignment = Alignment(
                horizontal="left", vertical="top", wrap_text=True)
        for col in (2, 3, 4, 7):
            ws2.cell(row=r, column=col).alignment = Alignment(horizontal="center", vertical="center")
    r += 1

END2 = r - 1
note2 = END2 + 2
ws2.cell(row=note2, column=2,
         value="Total ≈ 13,25 hari fokus → realistis 2,5–3 minggu kalau sambil kuliah (5 hari efektif/minggu).").font = font_caption()
ws2.cell(row=note2 + 1, column=2,
         value="Kalau waktu mepet: Jalur A dipilih + milestone 1–2 saja sudah membuat Sayangin 10x lebih layak pakai.").font = font_caption()

W2 = {2: 5, 3: 8, 4: 8, 5: 46, 6: 32, 7: 14}
for c, w in W2.items():
    ws2.column_dimensions[get_column_letter(c)].width = w
ws2.freeze_panes = "C5"
print_fit(ws2, "4:4")

# ============================================================
# SHEET 3 — KEPUTUSAN INFRA
# ============================================================
ws3 = wb.create_sheet("Keputusan Infra")
HEAD3 = ["Aspek", "Keputusan", "Detail / langkah setup"]
LAST3 = len(HEAD3) + 1  # col D (4)

CHOSEN = [
    ["Hosting", "Cloudflare Pages/Workers", "Adapter @opennextjs/cloudflare + nodejs_compat di wrangler.toml; domain mengarah ke Cloudflare"],
    ["Database", "Supabase Postgres", "schema.prisma: provider \"postgresql\"; DATABASE_URL = pooler Supabase (port 6543, transaction mode) — cocok untuk serverless"],
    ["Migrasi DB", "prisma migrate dari nol", "Data SQLite lama (db/custom.db) hanya data uji — tidak dibawa; jalankan db:generate + migrate deploy"],
    ["Rate limit", "Postgres — tabel rate_limit (atomic upsert)", "S-04: counter durable via pool pg bersama, tanpa akun & dep baru; fallback in-memory. Upstash cuma kalau traffic membesar"],
    ["Backup", "GitHub Actions cron → pg_dump mingguan", "S-05: dump setiap Minggu 10:00 WIB, artifact retensi 90 hari, restore drill otomatis ke Postgres bersih tiap jalan"],
    ["Monitoring", "Log Cloudflare + tabel error_log (Supabase)", "S-05: observability Workers + reportError() di semua API; Sentry ditunda — SDK Next.js belum stabil di OpenNext"],
    ["Biaya", "$0 — keduanya free tier", "Naik hanya kalau traffic ramai; tier gratis Supabase cukup untuk fase percobaan"],
]

setup_sheet(ws3, title="Keputusan Infra — DIPUTUSKAN 31 Okt 2026: Cloudflare + Supabase (S-03 ✅)", last_col=LAST3)
for c, h in enumerate(HEAD3, 2):
    ws3.cell(row=4, column=c, value=h)
style_header_row(ws3, 4, 2, LAST3)

for i, row in enumerate(CHOSEN):
    r = 5 + i
    for c, v in enumerate(row, 2):
        ws3.cell(row=r, column=c, value=v)
    style_data_row(ws3, r, 2, LAST3, i)
    ws3.row_dimensions[r].height = None
    ws3.cell(row=r, column=2).font = Font(name=FONT_NAME, size=11, bold=HEADER_BOLD, color=PRIMARY)
    for col in (3, 4):
        ws3.cell(row=r, column=col).alignment = Alignment(
            horizontal="left", vertical="top", wrap_text=True)

CHOSEN_END = 4 + len(CHOSEN)

# baris ringkasan (gaya totals)
SUM3 = CHOSEN_END + 1
ws3.cell(row=SUM3, column=2, value="Status")
ws3.cell(row=SUM3, column=3, value="✔ FINAL — payment QRIS ditunda sampai fase percobaan validasi (S-12)")
ws3.cell(row=SUM3, column=4, value="S-04 & S-05 rampung — MILESTONE 1 'Aman dipromosikan' tercapai; lanjut S-06 (admin)")
style_total_row(ws3, SUM3, 2, LAST3)
for col in (2, 3, 4):
    ws3.cell(row=SUM3, column=col).alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

# --- tabel referensi: jalur lain yang tidak dipilih ---
REF_CAPTION = SUM3 + 2
ws3.cell(row=REF_CAPTION, column=2,
         value="Referensi — dua jalur lain yang tidak dipilih (kalau nanti butuh pindah):").font = font_subheader()
ws3.row_dimensions[REF_CAPTION].height = 22

REF_HEAD = SUM3 + 3
REF_HEADS = ["Jalur", "Kekuatan", "Kenapa tidak sekarang"]
for c, h in enumerate(REF_HEADS, 2):
    ws3.cell(row=REF_HEAD, column=c, value=h)
style_header_row(ws3, REF_HEAD, 2, LAST3)

REFS = [
    ["Jalur A — VPS/Railway + SQLite + Litestream",
     "Paling cepat ke produksi; schema SQLite tidak berubah",
     "Butuh kelola server sendiri; Cloudflare+Supabase sudah dipilih dan free tier"],
    ["Jalur B — Vercel + Turso + Upstash",
     "Zero-ops serverless; Turso SQLite-compatible (migrasi paling gampang)",
     "User memilih Postgres Supabase + Cloudflare; struktur tetap tersimpan sebagai referensi"],
]
for i, row in enumerate(REFS):
    r = REF_HEAD + 1 + i
    for c, v in enumerate(row, 2):
        ws3.cell(row=r, column=c, value=v)
    style_data_row(ws3, r, 2, LAST3, i)
    ws3.row_dimensions[r].height = None
    ws3.cell(row=r, column=2).font = Font(name=FONT_NAME, size=11, bold=HEADER_BOLD, color=PRIMARY)
    for col in (3, 4):
        ws3.cell(row=r, column=col).alignment = Alignment(
            horizontal="left", vertical="top", wrap_text=True)

REF_END = REF_HEAD + len(REFS)
note3 = REF_END + 2
ws3.cell(row=note3, column=2,
         value="Urutan kerja tetap: S-01 (crypto) → S-02 (migrate) → setup stack ini (S-03) → S-04 → S-05 = Milestone 1 'Aman dipromosikan'.").font = font_caption()

W3 = {2: 16, 3: 40, 4: 40}
for c, w in W3.items():
    ws3.column_dimensions[get_column_letter(c)].width = w
ws3.page_setup.orientation = "landscape"
print_fit(ws3)

# ============================================================
wb.properties.creator = "Z.ai"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
print(f"OK -> {OUT}")
print(f"Sheet1 rows: {len(ISSUES)} issues, total est = {sum(x[7] for x in ISSUES)} hari")
