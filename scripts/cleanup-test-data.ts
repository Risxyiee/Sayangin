import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const delLetters = await db.letter.deleteMany({});
  const delSets = await db.letterSet.deleteMany({});
  const delGifts = await db.gift.deleteMany({});
  const delConf = await db.confession.deleteMany({});
  console.log(`Dihapus: ${delConf.count} confession, ${delSets.count} letterSet, ${delLetters.count} letter, ${delGifts.count} gift`);
  console.log("Sisa confession:", await db.confession.count());
  console.log("Sisa letterSet:", await db.letterSet.count());
  console.log("Sisa gift:", await db.gift.count());
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
