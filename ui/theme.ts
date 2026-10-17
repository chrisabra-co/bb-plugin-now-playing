// Theme fit: every style takes its colors from bb's active theme.
//
// bb themes set a canvas color, an ink color, and a primary color, and mix
// ink into canvas for all other surfaces. The styles do the same, so they
// fit light and dark themes alike. An accent must reach 4.5:1 against its
// surface; if it does not, it is pulled toward a color that reads.
import { useEffect, useState } from "react";
import type { AccentStyle } from "../shared";

export type Hex = `#${string}`;

export interface Theme {
  canvas: Hex;
  ink: Hex;
  primary: Hex;
  dark: boolean;
}

const FALLBACK: Theme = {
  canvas: "#1b1b1b",
  ink: "#d1d1d1",
  primary: "#e5e5e5",
  dark: true,
};

type Rgb = [number, number, number];

const toRgb = (hex: Hex): Rgb =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (rgb: Rgb): Hex =>
  `#${rgb
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("")}`;

/** `amount` of `a` mixed into `b`, in sRGB. */
export function mix(a: Hex, b: Hex, amount: number): Hex {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(x.map((v, i) => v * amount + y[i]! * (1 - amount)) as Rgb);
}

function luminance(hex: Hex): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: Hex, b: Hex): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pulls `color` toward `toward` until it reaches `min` against `surface`. */
export function readable(color: Hex, surface: Hex, toward: Hex, min = 4.5): Hex {
  for (let amount = 1; amount >= 0; amount -= 0.05) {
    const candidate = mix(color, toward, amount);
    if (contrast(candidate, surface) >= min) return candidate;
  }
  return toward;
}

/** Black or white, whichever reads better on `fill`. */
export const onColor = (fill: Hex): Hex =>
  contrast("#141414", fill) >= contrast("#ffffff", fill) ? "#141414" : "#ffffff";

export const isHex = (value: string): value is Hex => /^#[0-9a-f]{6}$/.test(value);

// Resolve any CSS color (oklch, color-mix, ...) to sRGB hex by painting it.
let paint: CanvasRenderingContext2D | null | undefined;
function cssToHex(color: string): Hex | null {
  if (paint === undefined) {
    paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  }
  if (paint === null || color === "") return null;
  paint.clearRect(0, 0, 1, 1);
  paint.fillStyle = "#000";
  paint.fillStyle = color;
  paint.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
  return a === 0 ? null : toHex([r!, g!, b!]);
}

function readTheme(probe: HTMLElement): Theme {
  const read = (variable: string) => {
    probe.style.color = `var(${variable})`;
    return cssToHex(getComputedStyle(probe).color);
  };
  const canvas = read("--background") ?? FALLBACK.canvas;
  const ink = read("--foreground") ?? FALLBACK.ink;
  const primary = read("--primary") ?? ink;
  return { canvas, ink, primary, dark: luminance(canvas) < luminance(ink) };
}

/**
 * The active bb theme. Re-reads when bb changes the palette or the light
 * or dark mode, or the system switches light and dark.
 */
function readThemeOnce(): Theme {
  const probe = document.createElement("span");
  probe.hidden = true;
  document.body.append(probe);
  try {
    return readTheme(probe);
  } finally {
    probe.remove();
  }
}

export function useTheme(): Theme {
  // Read before the first paint, so a light theme never flashes dark.
  const [theme, setTheme] = useState<Theme>(readThemeOnce);
  useEffect(() => {
    const probe = document.createElement("span");
    probe.hidden = true;
    document.body.append(probe);
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readTheme(probe);
        setTheme((prev) =>
          prev.canvas === next.canvas && prev.ink === next.ink && prev.primary === next.primary
            ? prev
            : next,
        );
      });
    };
    update();
    const observer = new MutationObserver(update);
    for (const node of [document.documentElement, document.body]) {
      observer.observe(node, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    }
    // bb applies a palette by rewriting a <style> element in <head>.
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scheme.removeEventListener("change", update);
      probe.remove();
    };
  }, []);
  return theme;
}

// ---------------------------------------------------------------------------
// Accents

export interface AccentInfo {
  /** The color a style uses when the user picks none; "theme" is primary. */
  fallback: Hex | "theme";
  /** The label of the default swatch. */
  defaultLabel: string;
}

export const ACCENTS: Record<AccentStyle, AccentInfo> = {
  hifi: { fallback: "#ffb224", defaultLabel: "Amber" },
  terminal: { fallback: "theme", defaultLabel: "Theme" },
  pocket: { fallback: "theme", defaultLabel: "Theme" },
  winamp: { fallback: "#00e400", defaultLabel: "Green" },
};

export const PRESETS: Hex[] = [
  "#ffb224",
  "#7fd6ff",
  "#f2624b",
  "#58f28a",
  "#ee6aa7",
  "#3b5bff",
  "#ffd60a",
];

export function accentColor(
  style: AccentStyle,
  stored: string | undefined,
  theme: Theme,
): Hex {
  if (stored !== undefined && isHex(stored)) return stored;
  const { fallback } = ACCENTS[style];
  return fallback === "theme" ? theme.primary : fallback;
}

// ---------------------------------------------------------------------------
// Palettes. The mix amounts match the "Theme fit" board in the design file.

export function surfaces(theme: Theme) {
  const { ink, canvas, dark } = theme;
  return {
    card: mix(ink, canvas, dark ? 0.07 : 0.035),
    border: mix(ink, canvas, dark ? 0.19 : 0.13),
    track: mix(ink, canvas, dark ? 0.16 : 0.12),
    text: ink,
    muted: readable(mix(ink, canvas, 0.7), canvas, ink),
  };
}

export function pocketPalette(theme: Theme, accent: Hex) {
  const base = surfaces(theme);
  return {
    ...base,
    fill: accent,
    glyph: onColor(accent),
    line: readable(accent, base.card, theme.ink, 3),
  };
}

export function terminalPalette(theme: Theme, accent: Hex) {
  const { ink, canvas, dark } = theme;
  const bg = dark ? mix("#000000", canvas, 0.35) : mix(ink, canvas, 0.03);
  const hi = readable(accent, bg, ink);
  return {
    dark,
    bg,
    border: mix(hi, bg, 0.25),
    hi,
    mid: readable(mix(hi, bg, 0.8), bg, ink),
    low: readable(mix(hi, bg, 0.6), bg, ink, 3),
    line: mix(hi, bg, 0.35),
    onHi: onColor(hi),
  };
}

const LCD = "#0e0d0b" as const;

/** A dark screen lit in the accent: bright, mid, and unlit segments. */
export function lcdPalette(accent: Hex, screen: Hex = LCD) {
  const hi = readable(accent, screen, "#ffffff");
  return {
    screen,
    hi,
    mid: readable(mix(hi, screen, 0.78), screen, "#ffffff", 3),
    dim: mix(hi, screen, 0.33),
    glow: `${hi}8c`,
  };
}

export function hifiPalette(theme: Theme, accent: Hex) {
  const { ink, canvas, dark } = theme;
  const body = dark
    ? {
        body1: mix(ink, canvas, 0.1),
        body2: mix(ink, canvas, 0.03),
        bodyBorder: mix(ink, canvas, 0.2),
        key1: mix(ink, canvas, 0.2),
        key2: mix(ink, canvas, 0.09),
        keyBorder: mix("#000000", canvas, 0.45),
        glyph: mix(ink, canvas, 0.85),
        label: mix(ink, canvas, 0.6),
        knob1: mix(ink, canvas, 0.3),
        knob2: mix(ink, canvas, 0.08),
      }
    : {
        body1: mix(ink, canvas, 0.04),
        body2: mix(ink, canvas, 0.11),
        bodyBorder: mix(ink, canvas, 0.2),
        key1: mix("#ffffff", canvas, 0.6),
        key2: mix(ink, canvas, 0.08),
        keyBorder: mix(ink, canvas, 0.3),
        glyph: mix(ink, canvas, 0.85),
        label: mix(ink, canvas, 0.65),
        knob1: mix("#ffffff", canvas, 0.7),
        knob2: mix(ink, canvas, 0.18),
      };
  return { dark, ...body, label: readable(body.label, body.body2, ink), lcd: lcdPalette(accent) };
}
