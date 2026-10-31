import Landing from "@/components/landing/Landing";
import ConfessionView from "@/components/confess/ConfessionView";
import LettersView from "@/components/confess/LettersView";
import StatusView from "@/components/confess/StatusView";
import { db } from "@/lib/db";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ k?: string; s?: string }>;
}) {
  const { k, s } = await searchParams;

  // Link kado penerima: /?k=<slug> → surat fullscreen
  // (bisa confess biasa atau open-when letters — deteksi dari DB)
  if (k) {
    const [confession, letterSet] = await Promise.all([
      db.confession.findUnique({ where: { slug: k }, select: { id: true } }),
      db.letterSet.findUnique({ where: { slug: k }, select: { id: true } }),
    ]);
    if (letterSet) return <LettersView slug={k} />;
    return <ConfessionView slug={k} />; // view sendiri menangani 404
  }

  // Halaman status pengirim: /?s=<senderKey> → dashboard pantauan
  if (s) return <StatusView senderKey={s} />;

  return <Landing />;
}
