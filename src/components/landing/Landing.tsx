"use client";

import Navbar from "./Navbar";
import Hero from "./Hero";
import Marquee from "./Marquee";
import ConfessSection from "./ConfessSection";
import StatusTeaser from "./StatusTeaser";
import KadoSurpriseSection from "./KadoSurpriseSection";
import TimelineSection from "./TimelineSection";
import HowItWorks from "./HowItWorks";
import Pricing from "./Pricing";
import Faq from "./Faq";
import FooterCta from "./FooterCta";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Marquee />
        <ConfessSection />
        <StatusTeaser />
        <KadoSurpriseSection />
        <TimelineSection />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FooterCta />
      </main>
    </div>
  );
}
