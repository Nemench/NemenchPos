// Derives the app's --blue-* shade family from a single admin-picked brand color.

function hexToHsl(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) => Math.round(255 * f(n)).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

const clampL = (l: number) => Math.max(0, Math.min(100, l));

export function deriveShades(hex: string): { blue: string; blueDark: string; blueHover: string; blueLight: string } {
  const [h, s, l] = hexToHsl(hex);
  return {
    blue: hex,
    blueDark: hslToHex(h, s, clampL(l - 18)),
    blueHover: hslToHex(h, s, clampL(l - 8)),
    blueLight: hslToHex(h, Math.max(20, s - 30), clampL(l + 38))
  };
}

export function applyTheme(hex: string): void {
  if (!hex) return;
  const shades = deriveShades(hex);
  const root = document.documentElement.style;
  root.setProperty("--blue", shades.blue);
  root.setProperty("--blue-dark", shades.blueDark);
  root.setProperty("--blue-hover", shades.blueHover);
  root.setProperty("--blue-light", shades.blueLight);
}

// ── Light/dark mode ──────────────────────────────────────────────────────────
// The authoritative preference is saved per-account on the server (see
// auth.setThemeMode/applyUserThemeMode in App.tsx), so it follows a user to
// any terminal they log into. localStorage here is only the pre-login/
// no-account fallback (login screen, or before /auth/me resolves) — kept
// separate from the brand color above, which every device should share.

export type ThemeMode = "light" | "dark";
const THEME_MODE_KEY = "nemenchpos-theme-mode";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function getStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_KEY);
  return stored === "light" || stored === "dark" ? stored : (systemPrefersDark() ? "dark" : "light");
}

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem(THEME_MODE_KEY, mode);
}

// Resolves the mode to use on first load (stored preference, else system) and
// applies it immediately — called once at module scope in App.tsx so there's
// no flash of the wrong theme before React's first render.
export function initThemeMode(): ThemeMode {
  const mode = getStoredThemeMode();
  document.documentElement.setAttribute("data-theme", mode);
  return mode;
}
