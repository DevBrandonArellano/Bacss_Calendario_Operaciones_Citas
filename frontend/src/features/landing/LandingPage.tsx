import { Faq, Features, FinalCta, Hero, HowItWorks, Verticals } from "@/features/landing/sections";

/** Home pública. Sin dependencia de sesión ni de estado del cliente: se pre-renderiza en el build. */
export function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <Verticals />
      <HowItWorks />
      <Faq />
      <FinalCta />
    </>
  );
}
