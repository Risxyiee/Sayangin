/**
 * Generator PRD Sayangin (Bahasa Indonesia) — docx skill compliant.
 * Cover: Recipe R4 (Top Color Block) + palet GO-1 (Graphite Orange, standar PRD).
 * Struktur: Cover → Daftar Isi (Roman) → 10 bab isi (Arabic, reset ke 1).
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableLayoutType,
  TableOfContents, PageBreak, LevelFormat,
} = require("docx");
const fs = require("fs");

/* ---------- palet GO-1 (Graphite Orange — proposals / PRD) ---------- */
const P = {
  bg: "1A2330", accent: "D4875A",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "D4875A", headerText: "FFFFFF", accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB" },
};
const INK = "1A2330"; // warna judul bab (graphite)
const FONTS = { ascii: "Times New Roman", eastAsia: "SimSun" };
const HFONTS = { ascii: "Times New Roman", eastAsia: "SimHei" };

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };

/* ---------- helper umum ---------- */
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 180, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: INK, font: HFONTS })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: INK, font: HFONTS })],
  });
}
function body(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, size: 24, color: "000000", font: FONTS })];
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 },
    spacing: { line: 312, after: opts.after ?? 80 },
    children: runs,
  });
}
function run(text, o = {}) {
  return new TextRun({ text, size: 24, color: "000000", font: FONTS, ...o });
}
function bullet(text) {
  return new Paragraph({
    bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 40 },
    children: [new TextRun({ text, size: 24, color: "000000", font: FONTS })],
  });
}
function numItem(ref, text) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 }, alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: "000000", font: FONTS })],
  });
}
function caption(text) {
  return new Paragraph({
    keepNext: true, spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: INK, font: FONTS })],
  });
}
function cellPara(text, o = {}) {
  return new Paragraph({
    alignment: o.align ?? AlignmentType.LEFT, spacing: { line: 312 },
    children: [new TextRun({ text, size: 21, bold: !!o.bold, color: o.color ?? "000000", font: FONTS })],
  });
}
function makeTable(headers, rows, widths, zebra = true) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => new TableCell({
          children: [cellPara(t, { bold: true, color: P.table.headerText })],
          shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
          margins: { top: 70, bottom: 70, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((t, i) => new TableCell({
          children: [cellPara(String(t))],
          shading: zebra && ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: P.table.surface } : undefined,
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      })),
    ],
  });
}
function emptyPara() { return new Paragraph({ children: [] }); }

/* ---------- calcTitleLayout + splitTitleLines (design-system) ---------- */
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\uFF0C\u3002\u3001\uFF1B\uFF1A\uFF01\uFF1F", ..."-_\u2014\u2013\u00B7/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // Latin ~55% lebar CJK; pakai estimasi mixed-width agar akurat untuk teks Latin
  const textWidth = (t, pt) => {
    let w = 0;
    for (const ch of t) {
      const code = ch.codePointAt(0);
      const isCJK = (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef);
      w += isCJK ? pt * 20 : pt * 11;
    }
    return w;
  };
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = Math.max(2, Math.floor(maxWidthTwips / (titlePt * 11))); // konservatif: asumsi Latin
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3 && lines.every((l) => textWidth(l, titlePt) <= maxWidthTwips)) break;
    titlePt -= 2;
  }
  if (!lines) lines = [title];
  return { titlePt, titleLines: lines };
}

/* ---------- Recipe R4: Top Color Block ---------- */
function buildCoverR4(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 26);
  const titleSize = titlePt * 2;

  const titleBlockHeight = titleLines.length * (titlePt * 23 + 200);
  const englishLabelH = config.englishLabel ? (9 * 23 + 500) : 0;
  const subtitleH = config.subtitle ? (12 * 23 + 200) : 0;
  const upperContentH = englishLabelH + titleBlockHeight + subtitleH;
  const UPPER_MIN = 7500;
  const UPPER_H = Math.max(UPPER_MIN, upperContentH + 1500 + 800);
  const DIVIDER_H = 60;
  const spacerIntrinsic = 280;
  const topSpacing = Math.max(UPPER_H - upperContentH - spacerIntrinsic - 800, 400);

  const upperBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: UPPER_H, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: "top",
        margins: { left: padL, right: padR },
        children: [
          new Paragraph({ spacing: { before: topSpacing } }),
          config.englishLabel ? new Paragraph({
            spacing: { after: 500 },
            children: [new TextRun({
              text: config.englishLabel.split("").join(" "),
              size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 60,
            })],
          }) : null,
          ...titleLines.map((line, i) => new Paragraph({
            spacing: { after: i < titleLines.length - 1 ? 100 : 200, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: line, size: titleSize, bold: true, color: P.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
          })),
          config.subtitle ? new Paragraph({
            spacing: { after: 100, line: 320, lineRule: "atLeast" },
            children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
          }) : null,
        ].filter(Boolean),
      })],
    })],
  });

  const divider = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: DIVIDER_H, rule: "exact" },
      children: [new TableCell({ borders: noBorders, shading: { type: ShadingType.CLEAR, fill: P.accent }, children: [emptyPara()] })],
    })],
  });

  const lowerContent = [
    new Paragraph({ spacing: { before: 800 } }),
    ...(config.metaLines || []).map((line) => new Paragraph({
      indent: { left: padL }, spacing: { after: 100 },
      children: [new TextRun({ text: line, size: 28, color: P.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    })),
    new Paragraph({ spacing: { before: 2000 } }),
    new Paragraph({
      indent: { left: padL },
      children: [
        new TextRun({ text: config.footerLeft || "", size: 22, color: "909090", font: { ascii: "Arial" } }),
        new TextRun({ text: "          ", font: { ascii: "Arial" } }),
        new TextRun({ text: config.footerRight || "", size: 22, color: "909090", font: { ascii: "Arial" } }),
      ],
    }),
  ];

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "FFFFFF" }, borders: noBorders,
        verticalAlign: "top",
        children: [upperBlock, divider, ...lowerContent],
      })],
    })],
  })];
}

/* ---------- footer bernomor (dibedakan warna untuk patch instrText) ---------- */
function pageFooter(markerColor) {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: markerColor, font: FONTS })],
    })],
  });
}
function docHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.innerLine, space: 4 } },
      children: [new TextRun({ text: "Sayangin \u2014 Dokumen Kebutuhan Produk", size: 18, color: "808080", font: FONTS })],
    })],
  });
}

/* ================= ISI DOKUMEN ================= */

/* ---- Bab 1 ---- */
const bab1 = [
  h1("1. Pernyataan Masalah"),
  body("Menyampaikan perasaan kepada seseorang secara langsung adalah salah satu momen sosial yang paling menegangkan bagi generasi Z Indonesia. Kebanyakan orang pada rentang usia 17\u201325 tahun memilih menahan diri: mereka takut ditolak, takut kehilangan pertemanan yang sudah ada, dan takut jejak digitalnya membocorkan identitas sebelum mereka siap. Akibatnya, perasaan tersebut sering tidak pernah tersampaikan, atau tersampaikan terlambat lewat media yang salah."),
  body("Media yang tersedia hari ini tidak dirancang untuk momen ini. Pesan lewat aplikasi perpesanan memaksa percakapan dua arah secara langsung, menciptakan tekanan jawab sekarang, dan meninggalkan identitas yang terbaca jelas. Formulir anonim semacam Google Form terasa dingin dan tidak berkesan, sementara kado fisik seperti buket bunga berbiaya ratusan ribu rupiah, membutuhkan alamat penerima, dan tidak praktis untuk pengakuan yang belum tentu diterima."),
  body("Sayangin menjawab masalah ini dengan mengubah pesan menjadi surat digital yang dikirim sebagai tautan anonim: penerima membuka surat dalam pengalaman yang sengaja dirancang berkesan (amplop, animasi, dan tipografi seperti surat sungguhan), lalu membalas dengan tenang tanpa tekanan. Identitas pengirim baru muncul apabila jawaban penerima positif. Di samping pengakuan cinta, produk yang sama menyediakan kado digital (buket bunga, photobox, kue, kupon cinta, dan playlist) untuk tahap hubungan selanjutnya, sehingga satu produk menemani siklus hubungan dari menyatakan perasaan hingga merayakannya."),
];

/* ---- Bab 2 ---- */
const bab2 = [
  h1("2. Pengguna Sasaran dan Persona"),
  body("Pengguna sasaran utama Sayangin adalah generasi Z Indonesia berusia 17\u201325 tahun: pelajar dan mahasiswa yang aktif bermedia sosial, terbiasa berkomunikasi lewat tautan, dan sensitif terhadap biaya. Produk memiliki dua peran pengguna yang sama pentingnya: pengirim (pembuat surat atau kado) dan penerima (pembuka tautan). Kedua peran dijabarkan dalam dua persona berikut."),
  caption("Tabel 1. Persona pengguna utama"),
  makeTable(
    ["Aspek", "Raka \u2014 pengirim", "Sari \u2014 penerima"],
    [
      ["Profil", "Mahasiswa semester 3, 19 tahun, aktif di X/Instagram", "Mahasiswi tingkat akhir, 21 tahun, sok hobinya dengar musik"],
      ["Situasi", "Suka pada rekan organisasi sejak setahun lalu, belum berani menyampaikan", "Menerima tautan anonim \u201cAda surat rahasia buat Sari\u201d dari grup teman"],
      ["Tujuan", "Menyampaikan perasaan secara jujur tanpa risiko memalukan langsung", "Tahu siapa pengirimnya dengan cara yang aman dan tidak memalukan"],
      ["Hambatan", "Takut ditolak di depan orang lain; takut korban percakapan kaku; dana terbatas", "Waspada tautan anonim (potensi iseng, scam, atau konten tidak pantas)"],
      ["Kebutuhan", "Cara kirim yang murah, cepat (\u00b13 menit), dan terasa personal; bisa memantau tanpa menyebalkan", "Pengalaman membuka yang menyenangkan; kontrol untuk melaporkan jika konten melanggar"],
    ],
    [16, 42, 42]
  ),
  body("Pasangan jarak jauh yang saling bertukar surat \u201copen when\u201d dan kado digital merupakan pengguna sekunder; kebutuhan mereka sudah terakomodasi tanpa fitur tambahan karena menggunakan alur pembuatan yang sama dengan pengirim persona pertama."),
];

/* ---- Bab 3 ---- */
const bab3 = [
  h1("3. Sasaran dan Non-Sasaran"),
  h2("3.1 Sasaran"),
  body("Sasaran produk untuk siklus MVP ini dinyatakan terukur agar dapat diverifikasi pada bab metrik (Bab 9):"),
  bullet("Menjadi cara termurah dan tercepat untuk menyampaikan perasaan: gratis tanpa akun, waktu dari menulis hingga mendapat tautan di bawah 3 menit."),
  bullet("Menghasilkan pengalaman membuka yang benar-benar berkesan sehingga penerima terdorong membagikan momennya (loop viral via tautan)."),
  bullet("Menjaga keamanan dan kenyamanan kedua pihak: anonimitas terjaga, ada mekanisme pelaporan, dan identitas pengirim terlindungi sampai jawaban positif."),
  bullet("Menyediakan jalur monetisasi ringan melalui kado premium di bawah Rp50 ribu tanpa mengorbankan fitur inti yang gratis."),
  h2("3.2 Non-Sasaran"),
  body("Batasan berikut disepakati agar ruang lingkup tetap realistis untuk satu pengembang:"),
  bullet("Bukan aplikasi perpesanan atau jejaring sosial: tidak ada feed, profil publik, atau percakapan dua arah berkelanjutan."),
  bullet("Tanpa sistem akun/login pada MVP: tidak ada onboarding pengguna, pemulihan kata sandi, atau penyimpanan data identitas."),
  bullet("Tanpa pengiriman barang fisik: seluruh kado berbentuk digital."),
  bullet("Tanpa notifikasi keluar (email/push/WA) pada MVP: pengirim memantau lewat halaman status."),
  bullet("Tanpa iklan dan tanpa penjualan data pengguna sebagai model bisnis."),
];

/* ---- Bab 4 ---- */
const bab4 = [
  h1("4. User Stories"),
  body("Cerita pengguna dikelompokkan per peran. Setiap cerita menjadi dasar kebutuhan fungsional pada Bab 6."),
  h2("4.1 Sebagai pengirim"),
  numItem("st-pengirim", "Sebagai pengirim, saya ingin menulis surat pengakuan dengan nama saya bersifat opsional, sehingga saya tetap bisa jujur tanpa membocorkan identitas."),
  numItem("st-pengirim", "Sebagai pengirim, saya ingin menerima dua tautan terpisah (tautan penerima dan tautan status), sehingga saya bisa membagikan yang pertama dan menyimpan yang kedua untuk diri sendiri."),
  numItem("st-pengirim", "Sebagai pengirim, saya ingin melihat status \u201csudah dibuka/belum\u201d dan jumlah kunjungan, sehingga saya tidak bertanya langsung kepada penerima."),
  numItem("st-pengirim", "Sebagai pengirim, saya ingin membaca balasan tertulis dari penerima di halaman status, sehingga percakapan dapat berlanjut secara terkendali."),
  numItem("st-pengirim", "Sebagai pengirim, saya ingin membuat rangkaian surat \u201copen when\u201d yang terbuka mingguan, sehingga penerima mendapat teman bercerita dalam jangka panjang."),
  numItem("st-pengirim", "Sebagai pengirim, saya ingin membuat kado digital (buket, photobox, kue, kupon, playlist) dengan tema pilihan, sehingga momen spesial tetap dirayakan meski jarak dan biaya menjadi batasan."),
  h2("4.2 Sebagai penerima"),
  numItem("st-penerima", "Sebagai penerima, saya ingin membuka tautan dan langsung memahami apa yang harus dilakukan, sehingga saya tidak bingung atau curiga."),
  numItem("st-penerima", "Sebagai penerima, saya ingin membaca surat dengan pengalaman yang tenang (animasi amplop, efek ketik), sehingga momennya terasa istimewa."),
  numItem("st-penerima", "Sebagai penerima, saya ingin membalas secara tertulis tanpa dipakai cepat, sehingga saya bisa menjawab dengan sungguh-sungguh."),
  numItem("st-penerima", "Sebagai penerima, saya ingin melaporkan konten yang tidak pantas, sehingga tautan jahat cepat disembunyikan."),
  numItem("st-penerima", "Sebagai penerima, saya ingin surat mingguan terbuka bertahap sejak saya menekan mulai, sehingga ritme membacanya terjaga."),
  h2("4.3 Sebagai pengelola"),
  numItem("st-pengelola", "Sebagai pengelola, saya ingin konten dengan tiga laporan atau lebih otomatis disembunyikan sementara, sehingga moderasi berjalan tanpa saya standby 24 jam."),
  numItem("st-pengelola", "Sebagai pengelola, saya ingin seluruh teks bebas pada setiap tipe kado terkumpul dalam satu pemeriksaan filter, sehingga konten kasar tidak lolos lewat celah isian."),
];

/* ---- Bab 5 ---- */
const bab5 = [
  h1("5. Prioritas Fitur"),
  body("Prioritas dibagi tiga tingkat: MVP (sudah dirilis dan berjalan), v2 (siklus berikutnya), dan Nanti (belum dijadwalkan). Pemilihan v2 mengikuti keputusan pemilik produk: penguatan loop pembuatan surat dengan bantuan AI diutamakan karena menyasar penghambat terbesar pengirim, yaitu menyusun kalimat."),
  caption("Tabel 2. Prioritas fitur Sayangin"),
  makeTable(
    ["Kode", "Fitur", "Prioritas", "Status"],
    [
      ["F-01", "Buat surat pengakuan anonim + dua tautan", "MVP", "Sudah jadi"],
      ["F-02", "Halaman penerima (amplop, animasi) + balasan tertulis", "MVP", "Sudah jadi"],
      ["F-03", "Halaman status pantauan pengirim", "MVP", "Sudah jadi"],
      ["F-04", "Open When Letters (terbuka mingguan)", "MVP", "Sudah jadi"],
      ["F-05", "Kado digital: buket bunga", "MVP", "Sudah jadi"],
      ["F-06", "Kado digital: photobox", "MVP", "Sudah jadi"],
      ["F-07", "Kado digital: kue tiup lilin", "MVP", "Sudah jadi"],
      ["F-08", "Kado digital: love coupons", "MVP", "Sudah jadi"],
      ["F-09", "Kado digital: playlist kita", "MVP", "Sudah jadi"],
      ["F-10", "Metadata berbagi dinamis (OpenGraph) per tautan", "MVP", "Sudah jadi"],
      ["F-11", "Moderasi komunitas (lapor + sembunyikan otomatis)", "MVP", "Sudah jadi"],
      ["F-12", "Pengalaman visual editorial + hero 3D interaktif", "MVP", "Sudah jadi"],
      ["F-13", "AI draf surat: menyusun kalimat dari poin kasar penulis", "v2", "Direncanakan"],
      ["F-14", "Surat suara (rekaman pendek)", "Nanti", "Belum dijadwalkan"],
      ["F-15", "Notifikasi WhatsApp/Telegram untuk pengirim", "Nanti", "Belum dijadwalkan"],
      ["F-16", "Tema visual baru dan tipe kado tambahan", "Nanti", "Belum dijadwalkan"],
    ],
    [10, 56, 14, 20]
  ),
  body("Fitur v2 tunggal (F-13) dipilih karena berdampak langsung pada konversi langkah pertama: semakin banyak calon pengirim yang berhasil menyelesaikan suratnya, semakin banyak tautan yang beredar. Fitur tingkat Nanti sengaja tidak dijadwalkan agar v2 tetap fokus."),
];

/* ---- Bab 6 ---- */
const bab6 = [
  h1("6. Kebutuhan Fungsional MVP"),
  h2("6.1 F-01 \u2014 Buat Surat Pengakuan Anonim"),
  body("Pengirim mengisi nama penerima (wajib), nama pengirim (opsional, kosong berarti anonim), isi surat, dan tema visual. Sistem menghasilkan dua tautan: tautan penerima berformat /?k={slug} dan tautan status berformat /?s={senderKey}. Kedua kunci dibangkitkan acak dan unik agar tidak dapat ditebak."),
  bullet("Kriteria terima: surat tersimpan dan kedua tautan berfungsi dalam waktu kurang dari 3 menit alur penuh; kosongnya nama pengirim tidak menghentikan proses; validasi input menolak isian kosong pada nama penerima dan isi surat."),
  h2("6.2 F-02 \u2014 Halaman Penerima dan Loop Balasan"),
  body("Tautan penerima menampilkan pengalaman membuka berurutan: amplop tersegel dengan nama penerima, animasi pembukaan, lalu isi surat dengan efek ketik. Penerima dapat menulis balasan tertulis yang tampil pada halaman status pengirim; tanggapan positif pada pengakuan memicu penampakan identitas pengirim sesuai janji produk."),
  bullet("Kriteria terima: pengalaman berjalan tanpa JavaScript yang berat di ponsel kelas menengah; balasan tersimpan dan muncul di halaman status pengirim; tidak ada elemen yang membocorkan identitas pengirim sebelum waktunya."),
  h2("6.3 F-03 \u2014 Halaman Status Pantauan Pengirim"),
  body("Halaman status menampilkan kondisi terkini surat atau kado: jumlah kunjungan, waktu pertama dibuka, balasan tertulis penerima, dan untuk kupon cinta kupon mana yang sudah dipakai. Halaman ini menggantikan kebutuhan notifikasi pada MVP."),
  bullet("Kriteria terima: data status ditarik per senderKey; pengirim lain tidak dapat mengubah isi surat dari halaman ini; halaman tidak tershared tanpa sengaja karena pengirim diingatkan bahwa tautan ini bersifat pribadi."),
  h2("6.4 F-04 \u2014 Open When Letters"),
  body("Pengirim membuat satu set berisi beberapa surat berjudul bebas dengan urutan tertentu. Setiap surat memiliki jeda terkunci berbasis hari (0 = langsung, 7 = minggu pertama, dan seterusnya). Penghitungan dimulai ketika penerima menekan tombol mulai, bukan ketika tautan dibuat, sehingga jeda tidak terbuang sebelum penerima mengetahui tautannya."),
  bullet("Kriteria terima: surat dengan jeda belum habis tampil terkunci beserta hitungan menunggu; tombol mulai hanya berlaku sekali; surat yang terbuka dapat dibalas per surat."),
  h2("6.5 F-05 sampai F-09 \u2014 Kado Digital"),
  body("Lima tipe kado berbagi satu kerangka: pengirim memilih tipe, mengisi konten spesifik tipe, memilih tema, lalu mendapat tautan penerima dan tautan status. Batasan konten divalidasi di sisi server agar data tetap ringan dan pengalaman membuka tetap cepat."),
  caption("Tabel 3. Batasan konten per tipe kado"),
  makeTable(
    ["Tipe kado", "Isi wajib", "Batas validasi"],
    [
      ["Buket bunga", "Kartu ucapan; pilihan bunga", "Kartu 5\u2013400 karakter; 3\u20139 bunga dari 6 jenis (mawar, tulip, matahari, lavender, daisy, sakura)"],
      ["Photobox", "Caption; 3\u20134 foto; catatan opsional", "Caption 2\u201360 karakter; foto JPEG/PNG/WebP maksimal \u00b1220 ribu karakter base64 per foto; catatan maksimal 300 karakter"],
      ["Kue tiup lilin", "Pilihan acara; pesan", "Acara: ulang tahun, anniversary, atau graduasi; pesan 5\u2013300 karakter"],
      ["Love coupons", "3\u20136 kupon berjudul bebas", "Judul 2\u201340 karakter; deskripsi opsional maksimal 80 karakter; kupon dapat ditandai terpakai"],
      ["Playlist kita", "Judul playlist; pesan penutup; 3\u201315 lagu", "Judul 3\u201360 karakter; pesan 5\u2013400 karakter; per lagu: judul wajib, artis dan catatan opsional, tautan opsional berformat http(s)"],
    ],
    [16, 32, 52]
  ),
  bullet("Kriteria terima: setiap tipe memiliki halaman penerima bertema; kupon terpakai tersimpan dalam data progres dan tidak dapat dikembalikan; seluruh teks bebas lolos pemeriksaan moderasi sebelum tampil."),
  h2("6.6 F-10 \u2014 Metadata Berbagi Dinamis"),
  body("Setiap tautan penerima menghasilkan pratinjau berbagi yang personal dan memancing rasa penasaran pada WhatsApp dan X/Twitter, misalnya \u201cAda surat rahasia buat Sari\u201d atau \u201cAda buket bunga buat Sari\u201d, dilengkapi gambar OpenGraph 1200\u00D7630 yang dibangkitkan per tautan. Halaman status sengaja tidak diindeks mesin pencari dan tidak membocorkan isi."),
  bullet("Kriteria terima: judul pratinjau menyebut nama penerima; gambar pratinjau selalu tampil; halaman penerima dan status berstatus noindex."),
  h2("6.7 F-11 \u2014 Moderasi Komunitas"),
  body("Moderasi dirancang untuk operasi tanpa tim: penerima dapat melaporkan konten; ketika jumlah laporan mencapai tiga atau lebih, konten disembunyikan sementara secara otomatis. Seluruh teks bebas dari semua tipe kado dikumpulkan lewat satu fungsi pemeriksaan yang sama sehingga tidak ada isian yang lolos dari filter."),
  bullet("Kriteria terima: laporan ketiga langsung menyembunyikan konten dari tautan penerima; pengirim tetap dapat melihat status bahwa konten dinonaktifkan sementara; tidak ada konten yang tampil tanpa melewati pemeriksaan teks."),
  h2("6.8 F-12 \u2014 Pengalaman Visual dan Animasi"),
  body("Seluruh antarmuka mengikuti bahasa desain editorial kertas dan tinta: latar gelap hangat, tipografi serif, kartu kertas dengan selotip, tanpa gradien mencolok. Halaman beranda menampilkan panggung tiga dimensi interaktif berupa kartu surat melayang yang miring mengikuti kursor dengan kedalaman lapisan nyata; animasi menghormati preferensi pengguna yang memilih pengurangan gerak, dan tetap hidup di perangkat sentuh melalui goyangan otomatis."),
  bullet("Kriteria terima: tidak ada overflow horizontal pada layar 390 piksel; animasi berjalan mulus tanpa error konsol; pengguna dengan preferensi reduced motion mendapat versi statis."),
];

/* ---- Bab 7 ---- */
const bab7 = [
  h1("7. Sketsa Model Data"),
  body("Model data berikut sudah terimplementasi pada Prisma dengan SQLite. Empat tabel menampung tiga jenis konten: pengakuan (Confession), rangkaian surat (LetterSet + Letter), dan kado (Gift). Setiap konten memiliki slug unik untuk tautan penerima dan senderKey unik untuk halaman status. Karena SQLite tidak memiliki tipe JSON, isi spesifik kado dan progres pemakaian disimpan sebagai string JSON yang divalidasi dengan skema Zod sebelum masuk basis data."),
  caption("Tabel 4. Tabel Confession (surat pengakuan)"),
  makeTable(
    ["Field", "Tipe", "Keterangan"],
    [
      ["id", "String (cuid)", "Identitas utama"],
      ["slug / senderKey", "String, unik", "Kunci tautan penerima / kunci halaman status"],
      ["fromName, toName", "String", "Nama pengirim (boleh kosong) dan nama penerima (wajib)"],
      ["message, theme", "String", "Isi surat dan tema visual (default: rose)"],
      ["response, respondedAt", "String?, DateTime?", "Jawaban penerima dan waktunya"],
      ["reply, repliedAt", "String?, DateTime?", "Balasan tertulis penerima untuk loop dua arah"],
      ["views, reportCount", "Int", "Jumlah kunjungan; laporan (>=3 menyembunyikan konten)"],
      ["createdAt, openedAt", "DateTime", "Waktu dibuat dan pertama dibuka"],
    ],
    [26, 22, 52]
  ),
  caption("Tabel 5. Tabel LetterSet (rangkaian open when letters)"),
  makeTable(
    ["Field", "Tipe", "Keterangan"],
    [
      ["id", "String (cuid)", "Identitas utama"],
      ["slug / senderKey", "String, unik", "Kunci tautan penerima / status"],
      ["fromName, toName, theme", "String", "IdentitasOpsional, penerima, tema"],
      ["views, reportCount", "Int", "Kunjungan dan laporan moderasi"],
      ["openedAt, startedAt", "DateTime?", "Pertama mampir; jam sandiwaranya mulai berdetak"],
      ["letters", "Relation 1-N", "Daftar surat dalam set"],
    ],
    [26, 22, 52]
  ),
  caption("Tabel 6. Tabel Letter (satu surat dalam set)"),
  makeTable(
    ["Field", "Tipe", "Keterangan"],
    [
      ["id", "String (cuid)", "Identitas utama"],
      ["setId", "String (FK)", "Relasi ke set induk, dihapus berantai (cascade)"],
      ["order", "Int", "Urutan surat dalam set"],
      ["title, body", "String", "Judul dan isi surat"],
      ["unlockDays", "Int (default 0)", "Jeda terkunci: 0 = langsung, 7 = minggu pertama, dst."],
      ["views, openedAt", "Int, DateTime?", "Kunjungan dan waktu surat dibuka"],
      ["reply, repliedAt", "String?, DateTime?", "Balasan penerima untuk surat ini"],
    ],
    [26, 22, 52]
  ),
  caption("Tabel 7. Tabel Gift (kado digital, 5 tipe)"),
  makeTable(
    ["Field", "Tipe", "Keterangan"],
    [
      ["id", "String (cuid)", "Identitas utama"],
      ["slug / senderKey", "String, unik", "Kunci tautan penerima / status"],
      ["type", "String", "bouquet | photobox | cake | coupons | playlist"],
      ["fromName, toName, theme", "String", "Identitas opsional, penerima, tema"],
      ["data", "String (JSON)", "Konten spesifik tipe; divalidasi skema Zod per tipe"],
      ["progress", "String (JSON)", "Status pemakaian, mis. kupon yang sudah dicoret"],
      ["views, reportCount", "Int", "Kunjungan dan laporan moderasi"],
      ["createdAt, openedAt", "DateTime", "Waktu dibuat dan pertama dibuka"],
    ],
    [26, 22, 52]
  ),
  body("Catatan desain: indeks tambahan diletakkan pada setId (pencarian surat per set); seluruh kunci tautan dibangkitkan acak dengan panjang yang membuat pembacaan acak tidak praktis; foto photobox tersimpan sebagai base64 di dalam kolom data sehingga batas ukuran per foto menjadi penting bagi kesehatan basis data."),
];

/* ---- Bab 8 ---- */
const bab8 = [
  h1("8. Kasus Batas dan Kegagalan"),
  body("Tabel berikut memuat perilaku yang diharapkan untuk kondisi tidak ideal. Kasus yang sudah tertangani dinyatakan sebagai perilaku berjalan; sisanya menjadi catatan perbaikan untuk siklus v2."),
  caption("Tabel 8. Kasus batas dan kegagalan"),
  makeTable(
    ["No", "Skenario", "Perilaku yang diharapkan"],
    [
      ["1", "Tautan slug salah ketik atau sudah dihapus", "Halaman 404 ramah tanpa membocorkan apakah slug pernah ada"],
      ["2", "Foto photobox lebih besar dari batas", "Validasi Zod menolak dengan pesan \u201cfotonya kegedean\u201d sebelum tersimpan"],
      ["3", "Teks kado mengandung kata tidak pantas", "giftTexts() mengumpulkan semua teks bebas untuk difilter sebelum tampil"],
      ["4", "Konten dilaporkan 3 kali atau lebih", "Konten otomatis disembunyikan sementara dari tautan penerima"],
      ["5", "Penerima belum menekan mulai pada open when", "Seluruh surat dengan unlockDays lebih dari 0 tetap terkunci; tidak ada jeda yang terbuang"],
      ["6", "Penerima memindah tanggal perangkat ke depan", "Jeda mingguan dapat dilewati secara tidak sah \u2014 dicatat sebagai keterbatasan; validasi waktu sisi server masuk daftar v2"],
      ["7", "Penerima memuat ulang halaman berulang kali", "Penghitungan views bisa bertambah ganda \u2014 diterima pada MVP; deduplikasi masuk daftar v2"],
      ["8", "Pengirim tidak sengaja membagikan tautan status", "Tautan hanya membaca; risiko utama privasi pengirim \u2014 peringatan privat tercantum pada antarmuka"],
      ["9", "Perangkat penerima tanpa mouse (sentuh)", "Panggung 3D tetap hidup lewat goyangan ambient; tilt kursor dinonaktifkan"],
      ["10", "Pengguna memilih reduced motion", "Seluruh animasi looping dimatikan, konten tetap penuh dan terbaca"],
      ["11", "Banyak kado dibuat pada waktu sama (tulisan ramai)", "SQLite menulis berurutan satu penulis \u2014 cukup untuk skala saat ini; migrasi basis data masuk pertimbangan saat trafik naik"],
      ["12", "Base64 foto menumpuk basis data", "Batas \u00b1220 ribu karakter per foto dan maksimal 4 foto membatasi ukuran baris; pemantauan ukuran berkas basis data dilakukan berkala"],
    ],
    [7, 33, 60]
  ),
];

/* ---- Bab 9 ---- */
const bab9 = [
  h1("9. Metrik Keberhasilan"),
  body("Metrik diukur langsung dari kolom yang sudah tersedia pada basis data (views, openedAt, response, reply, createdAt) sehingga tidak perlu instrumentasi tambahan pada MVP. Seluruh angka pada tabel berikut adalah target siklus v2, bukan capaian historis, karena produk belum mengumpulkan data penggunaan publik."),
  caption("Tabel 9. Metrik keberhasilan dan target"),
  makeTable(
    ["Metrik", "Definisi pengukuran", "Target v2"],
    [
      ["Kecepatan membuat", "Waktu dari membuka beranda sampai tautan confess jadi", "< 3 menit pada ponsel"],
      ["Dibuka dalam 1\u00D724 jam", "Persentase surat yang openedAt terisi dalam sehari sejak dibagikan", ">= 60%"],
      ["Balasan penerima", "Persentase surat yang mendapat reply atau response", ">= 25%"],
      ["Berbalas dalam sehari", "Dari surat yang dibuka, persentase dibalas dalam 24 jam", ">= 40%"],
      ["Pengirim kembali", "Pengirim yang membuat konten kedua (surat/kado) dalam 30 hari", ">= 30%"],
      ["Kupon terpakai", "Rata-rata kupon love coupons yang dicoret per kado", ">= 50% dari jumlah kupon"],
      ["Kesehatan moderasi", "Konten dilaporkan >= 3 kali yang tersembunyi otomatis", "100% tanpa campur tangan manual"],
      ["Kualitas teknis", "Overflow horizontal di layar 390 piksel; error konsol di beranda", "0 kejadian"],
    ],
    [24, 50, 26]
  ),
  body("Metrik North Star untuk siklus ini adalah balasan penerima: produk hanya bermakna bila loop dua arah benar-benar terjadi, bukan sekadar tautan dibuka lalu dilupakan."),
];

/* ---- Bab 10 ---- */
const bab10 = [
  h1("10. Pertanyaan Terbuka"),
  body("Hal-hal berikut belum diputuskan dan perlu keputusan sebelum atau selama pengembangan v2. Mereka sengaja tidak dijadikan kebutuhan agar dokumen tidak mengada-ada."),
  caption("Tabel 10. Pertanyaan terbuka"),
  makeTable(
    ["No", "Pertanyaan", "Mengapa penting"],
    [
      ["1", "Domain produksi final apa yang dipakai?", "Menentukan nilai metadataBase untuk pratinjau berbagi yang benar di WhatsApp/X"],
      ["2", "Berapa lama data surat dan kado disimpan sebelum dihapus?", "Menjaga privasi (surat berisi hal personal) dan ukuran berkas SQLite"],
      ["3", "Apakah perlu persetujuan eksplisit dari orang yang fotonya diunggah di photobox?", "Risiko penyalahgunaan foto pihak lain \u2014 relevan dengan reputasi produk"],
      ["4", "Berapa batas pembuatan konten per IP per jam yang wajar?", "Mencegah spam berantai tanpa mengganggu pengguna sah"],
      ["5", "Harga pasti dan batasan kado premium (di bawah Rp50 ribu)?", "Menutup jalur monetisasi yang sudah dijanjikan di beranda"],
      ["6", "Apakah balasan penerima perlu opsi anonim juga?", "Saat ini balasan tampil di halaman status pengirim; anonimitas dua arah mengubah desain loop"],
      ["7", "Kapan migrasi SQLite ke PostgreSQL diperlukan?", "Menjadi pemicu rencana teknis bila kunjungan naik atau foto mulai menekan ukuran basis data"],
    ],
    [7, 48, 45]
  ),
  body("Keputusan atas pertanyaan-pertanyaan di atas akan ditambahkan sebagai lampiran revisi pada versi PRD berikutnya."),
];

/* ---------- perakitan dokumen ---------- */
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const numberingConfig = ["st-pengirim", "st-penerima", "st-pengelola"].map((ref) => ({
  reference: ref,
  levels: [{
    level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
  }],
}));

const doc = new Document({
  creator: "Sayangin",
  title: "Sayangin \u2014 Dokumen Kebutuhan Produk (PRD)",
  styles: {
    default: {
      document: {
        run: { font: FONTS, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: HFONTS, size: 32, bold: true, color: INK },
        paragraph: { spacing: { before: 360, after: 180, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: HFONTS, size: 28, bold: true, color: INK },
        paragraph: { spacing: { before: 260, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  numbering: { config: numberingConfig },
  sections: [
    { /* Section 1: Cover — margin 0, tanpa nomor halaman */
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR4({
        englishLabel: "PRODUCT REQUIREMENTS DOCUMENT",
        title: "Sayangin",
        subtitle: "Dokumen Kebutuhan Produk \u2014 Dokumentasi Produk Aktif dan Roadmap v2",
        metaLines: [
          "Versi: 1.0",
          "Tanggal: 31 Oktober 2026",
          "Status produk: Live (MVP)",
          "Penyusun: Tim Sayangin",
          "Distribusi: Internal",
        ],
        footerLeft: "sayangin",
        footerRight: "dokumen internal",
      }),
    },
    { /* Section 2: Daftar Isi — Roman */
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter("807F80") }, // marker Roman (dipatch ke \* ROMAN)
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Daftar Isi", bold: true, size: 32, font: HFONTS, color: INK })],
        }),
        new TableOfContents("Daftar Isi", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Catatan: Daftar isi ini dibuat dengan field code. Agar nomor halaman akurat setelah mengedit, klik kanan daftar isi lalu pilih \u201cUpdate Field\u201d.",
            italics: true, size: 18, color: "888888", font: FONTS,
          })],
        }),
        // tanpa PageBreak di sini: Section 3 bertipe NEXT_PAGE sudah memulai halaman baru
      ],
    },
    { /* Section 3: Isi — Arabic mulai 1 */
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageFooter("808080") }, // marker Arabic (dipatch ke \* arabic)
      children: [...bab1, ...bab2, ...bab3, ...bab4, ...bab5, ...bab6, ...bab7, ...bab8, ...bab9, ...bab10],
    },
  ],
});

const OUT = "/home/z/my-project/download/PRD_Sayangin.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK ->", OUT, buf.length, "bytes");
});
