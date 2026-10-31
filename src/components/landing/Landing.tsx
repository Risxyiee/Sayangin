"use client";

import Navbar from "./Navbar";
import Hero3D from "./Hero3D";
import Marquee from "./Marquee";
import ConfessSection from "./ConfessSection";
import GiftsSection from "./GiftsSection";
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
        <Hero3D />
        <Marquee />
        <ConfessSection />
        <GiftsSection />
        <TimelineSection />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FooterCta />
      </main>
    </div>
  );
}
