"use client";

import Navbar from "./Navbar";
import Hero from "./Hero";
import Marquee from "./Marquee";
import ConfessSection from "./ConfessSection";
import StatusTeaser from "./StatusTeaser";
import GiftsSection from "./GiftsSection";
import GiftStudio from "./GiftStudio";
import KadoSurpriseSection from "./KadoSurpriseSection";
import OpenWhenSection from "./OpenWhenSection";
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
        <GiftsSection />
        <GiftStudio />
        <KadoSurpriseSection />
        <OpenWhenSection />
        <TimelineSection />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FooterCta />
      </main>
    </div>
  );
}
