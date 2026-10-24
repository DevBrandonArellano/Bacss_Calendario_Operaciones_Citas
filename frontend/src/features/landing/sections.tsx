import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

import { Brand } from "@/components/Brand";
import { Card } from "@/components/ui/Card";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { FEATURES, STEPS, VERTICALS } from "@/features/landing/landingContent";
import { FAQ } from "@/seo/faq";
import { BUSINESSES_PAGE, FEATURES_PAGE, HOME_PAGE } from "@/seo/pages";

export const SECTION = "mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24";
const NAV_LINK = "text-sm font-medium text-ink no-underline hover:text-brand";

export function SectionHeading({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <h2 id={id} className="m-0 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-lg text-muted">{subtitle}</p>
    </div>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Bacss Citas, inicio" className="text-ink no-underline">
          <Brand />
        </Link>
        <nav aria-label="Secciones" className="hidden items-center gap-8 md:flex">
          <Link to={FEATURES_PAGE.path} className={NAV_LINK}>
            Funcionalidades
          </Link>
          <Link to={BUSINESSES_PAGE.path} className={NAV_LINK}>
            Para negocios
          </Link>
          <Link to="/#preguntas" className={NAV_LINK}>
            Preguntas frecuentes
          </Link>
        </nav>
        <Link to="/login" className={buttonStyles({ variant: "primary", size: "md" })}>
          Iniciar sesión
        </Link>
      </div>
    </header>
  );
}

function DashboardPreview() {
  const bars = [40, 65, 50, 85, 70, 95, 60];
  return (
    <div aria-hidden="true" className="rounded-2xl border border-line bg-surface p-4 shadow-float sm:p-6">
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          ["Citas hoy", "12"],
          ["Próx. 7 días", "58"],
          ["Ingresos", "$1.240"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-subtle p-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="text-xl font-bold text-ink">{value}</div>
          </div>
        ))}
      </div>
      <div className="flex h-32 items-end gap-2 rounded-xl bg-subtle p-4">
        {bars.map((height, index) => (
          <div key={index} className="flex-1 rounded-t-md bg-brand" style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {["09:00  Corte y barba", "10:30  Revisión general", "12:00  Toma de muestra"].map((row) => (
          <div key={row} className="rounded-lg border border-line px-3 py-2 text-sm text-ink">
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="bg-linear-to-b from-brand-soft to-page">
      <div className={`${SECTION} grid items-center gap-12 lg:grid-cols-2`}>
        <div>
          <h1 className="m-0 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            {HOME_PAGE.h1}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Bacss Citas reúne agenda, clientes, pagos y reportes en una sola plataforma, con reservas sin choques de
            horario y recordatorios por correo. Pensada para talleres, laboratorios, tiendas y despachos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className={buttonStyles({ variant: "primary", size: "lg" })}>
              Empezar ahora
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
            <Link to={FEATURES_PAGE.path} className={buttonStyles({ variant: "secondary", size: "lg" })}>
              Ver funcionalidades
            </Link>
          </div>
        </div>
        <DashboardPreview />
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section aria-labelledby="funciones-titulo" className={SECTION}>
      <SectionHeading
        id="funciones-titulo"
        title="Todo lo que necesitas para operar tu agenda"
        subtitle="Una plataforma completa, sin herramientas sueltas ni hojas de cálculo."
      />
      <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <li key={title}>
            <Card className="h-full">
              <span className="mb-4 grid size-11 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <h3 className="m-0 text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-muted">{description}</p>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-center">
        <Link to={FEATURES_PAGE.path} className={buttonStyles({ variant: "secondary" })}>
          Conocer todas las funcionalidades
        </Link>
      </p>
    </section>
  );
}

export function Verticals() {
  return (
    <section aria-labelledby="rubros-titulo" className="bg-subtle">
      <div className={SECTION}>
        <SectionHeading
          id="rubros-titulo"
          title="Una plataforma, módulos para tu rubro"
          subtitle="Activa solo lo que tu negocio necesita; cada empresa ve únicamente sus módulos."
        />
        <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2">
          {VERTICALS.map(({ name, description }) => (
            <li key={name}>
              <Card className="h-full">
                <h3 className="m-0 flex items-center gap-2 text-lg font-semibold text-ink">
                  <Check className="size-5 text-brand" aria-hidden="true" />
                  {name}
                </h3>
                <p className="mt-2 text-muted">{description}</p>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center">
          <Link to={BUSINESSES_PAGE.path} className={buttonStyles({ variant: "secondary" })}>
            Ver soluciones por rubro
          </Link>
        </p>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="como-titulo" className={SECTION}>
      <SectionHeading id="como-titulo" title="Cómo funciona" subtitle="De cero a tu primera cita en tres pasos." />
      <ol className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
        {STEPS.map(({ title, description }, index) => (
          <li key={title}>
            <Card className="h-full">
              <span className="text-sm font-bold text-brand">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="m-0 mt-2 text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-muted">{description}</p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Faq() {
  return (
    <section id="preguntas" aria-labelledby="preguntas-titulo" className="bg-subtle">
      <div className={SECTION}>
        <SectionHeading
          id="preguntas-titulo"
          title="Preguntas frecuentes"
          subtitle="Respuestas directas sobre lo que Bacss Citas hace hoy."
        />
        <div className="mx-auto grid max-w-3xl gap-4">
          {FAQ.map(({ question, answer }) => (
            <Card key={question}>
              <h3 className="m-0 text-lg font-semibold text-ink">{question}</h3>
              <p className="mt-2 text-muted">{answer}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-titulo" className={SECTION}>
      <div className="rounded-3xl bg-linear-to-br from-hero-from to-hero-to px-6 py-14 text-center text-on-hero-ink sm:px-12">
        <h2 id="cta-titulo" className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">
          Ordena tu agenda hoy
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg">Entra a tu cuenta y empieza a gestionar tus citas con claridad.</p>
        <Link
          to="/login"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 font-semibold text-hero-to no-underline hover:bg-white/90"
        >
          Iniciar sesión
        </Link>
      </div>
    </section>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
        <Brand />
        <nav aria-label="Pie de página" className="flex flex-wrap gap-6">
          <Link to={FEATURES_PAGE.path} className="text-muted">
            Funcionalidades
          </Link>
          <Link to={BUSINESSES_PAGE.path} className="text-muted">
            Para negocios
          </Link>
          <Link to="/login" className="text-muted">
            Iniciar sesión
          </Link>
        </nav>
        <p className="m-0">© Bacss Citas. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
