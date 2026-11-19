import { useEffect, useState } from "react";
import { Moon, Sun } from '../../icons/iconoir';

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    try {
      localStorage.setItem("posvenda-theme", isDark ? "dark" : "light");
    } catch {
      /* Preferência disponível nesta sessão. */
    }
  }, [isDark]);
  return (
    <button
      className={`theme-toggle ${className}`}
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Tema escuro"
      title={isDark ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => setIsDark((value) => !value)}
    >
      <span className="theme-toggle-thumb">
        {isDark ? (
          <Moon size={15} strokeWidth={1.5} />
        ) : (
          <Sun size={15} strokeWidth={1.5} />
        )}
      </span>
      <span className="theme-toggle-idle" aria-hidden="true">
        {isDark ? <Sun size={14} /> : <Moon size={14} />}
      </span>
    </button>
  );
}
