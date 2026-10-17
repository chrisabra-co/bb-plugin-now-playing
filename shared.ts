// Values that server.ts and the app both use. Keep this file free of Node
// imports: the app bundle runs in the browser.

export const STYLES = [
  "default",
  "minimal",
  "cover",
  "hifi",
  "terminal",
  "pocket",
  "winamp",
] as const;
export type PlayerStyle = (typeof STYLES)[number];

/** The styles with an accent the user can change. */
export const ACCENT_STYLES = ["hifi", "terminal", "pocket", "winamp"] as const;
export type AccentStyle = (typeof ACCENT_STYLES)[number];

export const hasAccent = (style: PlayerStyle): style is AccentStyle =>
  (ACCENT_STYLES as readonly string[]).includes(style);
