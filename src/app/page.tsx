import Landing from "@/components/landing/Landing";
import ConfessionView from "@/components/confess/ConfessionView";
import StatusView from "@/components/confess/StatusView";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ k?: string; s?: string }>;
}) {
  const { k, s } = await searchParams;

  // Link confess penerima: /?k=<slug> → halaman surat fullscreen
  if (k) return <ConfessionView slug={k} />;

  // Halaman status pengirim: /?s=<senderKey> → dashboard pantauan
  if (s) return <StatusView senderKey={s} />;

  return <Landing />;
}
