import { useTheme, type ThemePreference } from "@/hooks/useTheme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <label className="theme-toggle block">
      <span className="sr-only">Tema</span>
      <select
        aria-label="Tema"
        className="w-full rounded-xl text-sm"
        value={theme}
        onChange={(event) => setTheme(event.target.value as ThemePreference)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
