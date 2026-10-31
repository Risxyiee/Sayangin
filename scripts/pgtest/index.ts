// Variasi opsi SSL utk pg di workerd
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const REF = "nulaitlgupgfonqjqcol";
const HOST = "aws-0-ap-southeast-1.pooler.supabase.com";
const base = (extra: string) =>
  `postgresql://postgres.${REF}:SANDI_PALSU@${HOST}:6543/postgres${extra}`;

const CASES: [string, any][] = [
  ["ssl:true", { connectionString: base(""), ssl: true }],
  ["ssl:servername+noVerify", { connectionString: base(""), ssl: { rejectUnauthorized: false, servername: HOST } }],
  ["url sslmode=require", { connectionString: base("?sslmode=require") }],
  ["url sslmode=no-verify", { connectionString: base("?sslmode=no-verify") }],
];

async function testOne(label: string, cfg: any) {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ ...cfg, max: 1 }) });
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { label, hasil: "SUKSES" };
  } catch (e: any) {
    return { label, message: (e?.message ?? String(e)).slice(0, 90) };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

export default {
  async fetch(): Promise<Response> {
    const results = [];
    for (const [label, cfg] of CASES) results.push(await testOne(label, cfg));
    return Response.json(results);
  },
};
