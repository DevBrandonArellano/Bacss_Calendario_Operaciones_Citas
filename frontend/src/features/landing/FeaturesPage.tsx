import { Check } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { FEATURES } from "@/features/landing/landingContent";
import { FinalCta, SECTION } from "@/features/landing/sections";
import { FEATURES_PAGE } from "@/seo/pages";

export function FeaturesPage() {
  return (
    <>
      <section className={SECTION}>
        <h1 className="m-0 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
          {FEATURES_PAGE.h1}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          Bacss Citas incluye agenda con control de horarios, recordatorios por correo, gestión de clientes, registro de
          pagos, reportes y permisos por rol. Esto es lo que ofrece hoy cada área.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, description, points }) => (
            <Card key={title} className="h-full">
              <span className="mb-4 grid size-11 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <h2 className="m-0 text-xl font-semibold text-ink">{title}</h2>
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
