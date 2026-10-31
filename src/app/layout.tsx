import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Caveat } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "Sayang.in — Confess & Kado Digital buat Orang yang Kamu Sayang",
  description:
    "Suka sama seseorang tapi malu ngomong? Kirim confess anonim gratis. Sudah pacaran? Kirim kado digital: buket bunga, surat Open When, photobox, kue ulang tahun, dan timeline kisah kalian. Semua di bawah Rp50rb.",
  keywords: [
    "confess anonim",
    "kado digital",
    "kado ulang tahun pacar",
    "surat cinta digital",
    "website buat pacar",
    "hadiah anniversary",
  ],
  authors: [{ name: "Sayang.in" }],
  openGraph: {
    title: "Sayang.in — Confess tanpa malu, kado digital tanpa ribet",
    description:
      "Confess anonim gratis + kado digital lengkap di bawah Rp50rb. Bikin dia nangis (bahagia).",
    siteName: "Sayang.in",
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sayang.in — Confess tanpa malu, kado digital tanpa ribet",
    description:
      "Confess anonim gratis + kado digital lengkap di bawah Rp50rb.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${caveat.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
