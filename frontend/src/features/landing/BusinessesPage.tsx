import { Check } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { VERTICALS } from "@/features/landing/landingContent";
import { FinalCta, SECTION } from "@/features/landing/sections";
import { BUSINESSES_PAGE } from "@/seo/pages";

export function BusinessesPage() {
  return (
    <>
      <section className={SECTION}>
        <h1 className="m-0 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          {BUSINESSES_PAGE.h1}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          La agenda, los clientes y los pagos son comunes a todos los negocios. Encima se activan módulos pensados para
          cada rubro; cada empresa ve solamente los que tiene habilitados.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {VERTICALS.map(({ name, description, points }) => (
            <Card key={name} className="h-full">
              <h2 className="m-0 text-xl font-semibold text-ink">{name}</h2>
              <p className="mt-2 text-muted">{description}</p>
              <ul className="m-0 mt-4 grid list-none gap-2 p-0">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
      <FinalCta />
    </>
  );
}
