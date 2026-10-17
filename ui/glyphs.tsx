// Plugin-owned glyphs: BB's icon set has no media controls.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Glyph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

type GlyphProps = { className?: string };

export const PlayGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </Glyph>
);
export const PauseGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Glyph>
);
export const NextGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path d="M5 6.2v11.6a1 1 0 0 0 1.53.85l8.7-5.8a1 1 0 0 0 0-1.7l-8.7-5.8A1 1 0 0 0 5 6.2Z" />
    <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
  </Glyph>
);
export const PreviousGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path d="M19 6.2v11.6a1 1 0 0 1-1.53.85l-8.7-5.8a1 1 0 0 1 0-1.7l8.7-5.8A1 1 0 0 1 19 6.2Z" />
    <rect x="5" y="5" width="2.5" height="14" rx="1" />
  </Glyph>
);
export const ShuffleGlyph = ({ className, strokeWidth = 1.8 }: GlyphProps & { strokeWidth?: number }) => (
  <Glyph className={className}>
    <path
      d="M3 7h3.5c2 0 3 1 4.2 3.2l2.6 4.6C14.5 17 15.5 18 17.5 18H21M3 18h3.5c1.4 0 2.3-.5 3.1-1.5M14.4 8.5c.8-1 1.7-1.5 3.1-1.5H21M18.5 4.5 21 7l-2.5 2.5M18.5 15.5 21 18l-2.5 2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Glyph>
);
export const RepeatGlyph = ({ className, strokeWidth = 1.8 }: GlyphProps & { strokeWidth?: number }) => (
  <Glyph className={className}>
    <path
      d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M17 3l3 3-3 3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4M7 21l-3-3 3-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Glyph>
);
export const VolumeGlyph = ({ muted, className }: GlyphProps & { muted: boolean }) => (
  <Glyph className={cn("size-3.5", className)}>
    <path d="M4 9.5v5a1 1 0 0 0 1 1h2.6l4.3 3.6a.7.7 0 0 0 1.1-.5V5.4a.7.7 0 0 0-1.1-.5L7.6 8.5H5a1 1 0 0 0-1 1Z" />
    <path
      d={muted ? "m16 9.5 5 5m0-5-5 5" : "M16 9a4.2 4.2 0 0 1 0 6M18.5 6.5a7.8 7.8 0 0 1 0 11"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </Glyph>
);
export const NoteGlyph = ({ className }: GlyphProps) => (
  <Glyph className={cn("size-5", className)}>
    <path
      d="M9 17.5V6.2a1 1 0 0 1 .76-.97l9-2.2A1 1 0 0 1 20 4v11.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="6.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="15.5" r="2.5" />
  </Glyph>
);

/** Three small bars that show the player is making sound. */
export function Bars({ playing, color, className }: { playing: boolean; color: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("np-bars flex h-[9px] items-end gap-[2px]", playing && "np-bars-on", className)}>
      {[5, 9, 6].map((height, index) => (
        <span
          key={index}
          className="w-[2px] rounded-[1px]"
          style={{ height, backgroundColor: color }}
        />
      ))}
    </span>
  );
}
