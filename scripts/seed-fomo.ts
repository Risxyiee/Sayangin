// Seed data uji fitur FOMO — sekali pakai (idempoten-ish: kosongkan dulu).
// Jalankan: DATABASE_URL=postgresql://postgres:postgres@localhost:54329/degdegin bun scripts/seed-fomo.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.reactionCount.deleteMany();
  await db.confession.deleteMany();

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
  const tomorrow8pm = new Date();
  tomorrow8pm.setDate(tomorrow8pm.getDate() + 1);
  tomorrow8pm.setHours(20, 0, 0, 0);

  const rows = [
    {
      slug: "wallrose1",
      fromName: "Raka",
      toName: "Nadia",
      message: "Setiap ketawa kamu bikin hariku baik-baik aja. Aku suka kamu, sudah lama.",
      theme: "rose",
      isPublic: true,
      createdAt: hoursAgo(0.4),
      response: "yes",
      reacted: { heart: 34, laugh: 2, cry: 7, bloom: 12 },
    },
    {
      slug: "wallsunse",
      fromName: "Dimas",
      toName: "Sari",
      message: "Senja jam 6 selalu bikin aku ingat kamu. Boleh nggak kita jalan pelan-pelan?",
      theme: "sunset",
      isPublic: true,
      createdAt: hoursAgo(2),
      respondedAt: hoursAgo(1.2),
      response: "later",
      reacted: { heart: 12, laugh: 1, cry: 21, bloom: 4 },
    },
    {
      slug: "wallsakur",
      fromName: "Anonim",
      toName: "Bella",
      message: "Selembut kelopak yang jatuh, perasaanku ke kamu juga gitu — pelan tapi pasti.",
      theme: "sakura",
      isPublic: true,
      createdAt: hoursAgo(5),
      reacted: { heart: 51, laugh: 0, cry: 3, bloom: 29 },
    },
    {
      slug: "wallmatch",
      fromName: "Fajar",
      toName: "Citra",
      message: "Senin terasa kayak Jumat kalau kelasku ada kamu. Matcha order dua, salah satu buat kamu.",
      theme: "matcha",
      isPublic: true,
      createdAt: hoursAgo(9),
      response: "yes",
      respondedAt: hoursAgo(8),
      reacted: { heart: 18, laugh: 9, cry: 0, bloom: 8 },
    },
    {
      slug: "wallmidni",
      fromName: "Seseorang",
      toName: "Kevin",
      message: "Malam ini langit penuh bintang, tapi aku cuma bisa mikirin satu orang.",
      theme: "midnight",
      isPublic: true,
      createdAt: hoursAgo(26),
      reacted: { heart: 7, laugh: 0, cry: 2, bloom: 1 },
    },
    {
      slug: "wallhanya",
      fromName: "Gilang",
      toName: "Maya",
      message: "Aku nggak minta dijawab sekarang. Cuma pengen kamu tahu.",
      theme: "rose",
      isPublic: true,
      createdAt: hoursAgo(40),
      reacted: { heart: 40, laugh: 1, cry: 15, bloom: 6 },
    },
    {
      // terkunci: kirim terjadwal — countdown di penerima
      slug: "lockdemo1",
      fromName: "Rahasia",
      toName: "Dinda",
      message: "Surat ini sengaja dijadwalkan. Kalau kamu baca ini, artinya waktunya sudah tiba.",
      theme: "midnight",
      isPublic: false,
      unlockAt: tomorrow8pm,
      reacted: null,
    },
    {
      // privat: TIDAK boleh muncul di dinding
      slug: "private1",
      fromName: "Tara",
      toName: "Yoga",
      message: "Ini surat privat, tidak boleh tampil di dinding.",
      theme: "rose",
      isPublic: false,
      reacted: null,
    },
  ];

  for (const r of rows) {
    const { reacted, ...data } = r;
    const c = await db.confession.create({ data });
    if (reacted) {
      await db.reactionCount.create({
        data: { confessionId: c.id, ...reacted },
      });
    }
    console.log(`seed ${c.slug} ok`);
  }
  console.log("SEED DONE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
