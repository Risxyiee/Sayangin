import { PrismaClient } from "@prisma/client";

// Hapus confession uji berdasar slug — supaya DB produksi tidak menumpuk data tes.
// Pemakaian: bun scripts/cleanup_confess_slug.ts <slug1> <slug2> ...
const db = new PrismaClient();

async function main() {
  const slugs = process.argv.slice(2).filter(Boolean);
  if (!slugs.length) {
    console.log("tidak ada slug yang dihapus");
    return;
  }
  const res = await db.confession.deleteMany({ where: { slug: { in: slugs } } });
  console.log(`Dihapus ${res.count} confession uji: ${slugs.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
