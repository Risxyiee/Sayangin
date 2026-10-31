import Landing from "@/components/landing/Landing";
import ConfessionView from "@/components/confess/ConfessionView";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;

  // Link confess: /?k=<slug> → tampilkan halaman surat fullscreen
  return k ? <ConfessionView slug={k} /> : <Landing />;
}
