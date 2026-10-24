import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "disabled:cursor-not-allowed disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border border-brand bg-brand text-on-brand shadow-card hover:bg-brand-hover hover:border-brand-hover",
  secondary: "border border-line bg-surface text-ink shadow-card hover:bg-subtle",
  ghost: "border border-transparent bg-transparent text-ink shadow-none hover:bg-subtle",
  danger: "border border-negative bg-negative-soft text-negative shadow-none hover:bg-negative hover:text-surface",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Fuente única de estilos de botón: sirve igual para `<button>` y `<Link>`. */
export function buttonStyles({ variant = "secondary", size = "md", className }: ButtonStyleOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}
