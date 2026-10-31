import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

// Font di-host sendiri (src/fonts) — build & dev nggak perlu fetch ke
// fonts.googleapis.com lagi: lebih cepat, hermetik, dan aman buat
// environment offline. File latin variable diunduh dari Google Fonts.
const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

const caveat = localFont({
  src: "../fonts/caveat-latin.woff2",
  variable: "--font-caveat",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "Sayangin — surat untuk orang yang kamu sayang",
  description:
    "Tulis pengakuan sebagai surat anonim, kirim cukup lewat link. Sudah jadian? Kirim kado digital: buket bunga, surat Open When, photobox, kue tiup lilin. Gratis untuk confess.",
  keywords: [
    "confess anonim",
    "kado digital",
    "kado ulang tahun pacar",
    "surat cinta digital",
    "website buat pacar",
    "hadiah anniversary",
  ],
  authors: [{ name: "Sayangin" }],
  openGraph: {
    title: "Sayangin — surat untuk orang yang kamu sayang",
    description:
      "Confess anonim gratis lewat link, plus kado digital sekali bayar. Ditulis kamu, dibuka dia.",
    siteName: "Sayangin",
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sayangin — surat untuk orang yang kamu sayang",
    description: "Confess anonim gratis lewat link, plus kado digital sekali bayar.",
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
