import { CheckCircle2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/features/auth/useAuth";
import { PRIVATE_PAGE } from "@/seo/pages";
import { usePageMeta } from "@/seo/usePageMeta";

const HIGHLIGHTS = [
  "Reservas sin choques de horario",
  "Recordatorios automáticos a tus clientes",
  "Un espacio aislado y seguro para cada empresa",
];

export function LoginPage() {
  usePageMeta({ ...PRIVATE_PAGE, title: "Iniciar sesión | Bacss Citas" });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/citas";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo iniciar sesión.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-page text-ink lg:grid-cols-[1.1fr_1fr]">
      <section
        aria-label="Presentación"
        className="hidden flex-col justify-center gap-8 bg-linear-to-br from-hero-from to-hero-to p-16 text-on-hero-ink lg:flex"
      >
        <Brand tone="onHero" />
        <p className="m-0 max-w-xl text-4xl font-extrabold leading-tight tracking-tight">
          Agenda, clientes y operaciones de tu negocio en un solo lugar
        </p>
        <ul className="m-0 grid list-none gap-3 p-0 text-lg">
          {HIGHLIGHTS.map((text) => (
            <li key={text} className="flex items-center gap-3">
              <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col items-center justify-center gap-6 p-6">
        <div className="lg:hidden">
          <Brand />
        </div>
        <Card className="w-full max-w-md p-8 shadow-float">
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <h1 className="mb-2 text-2xl font-bold">Iniciar sesión</h1>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
            <label htmlFor="password" className="mt-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" variant="primary" size="lg" disabled={submitting} className="mt-4">
              {submitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </Card>
        <Link to="/" className="text-sm text-muted">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
