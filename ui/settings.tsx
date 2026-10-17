// The "Player style" section on the plugin's settings page.
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { Appearance, AppearancePatch, rpcContract } from "../server";
import { STYLES, hasAccent } from "../shared";
import type { AccentStyle, PlayerStyle } from "../shared";
import { cn } from "@/lib/utils";
import type { PlayerActions, ReadyPlayer } from "./player";
import { useAppearance, useArtworkUrl, usePlayer } from "./player";
import { STYLE_INFO } from "./styles";
import {
  ACCENTS,
  PRESETS,
  accentColor,
  contrast,
  isHex,
  lcdPalette,
  pocketPalette,
  surfaces,
  terminalPalette,
  useTheme,
} from "./theme";
import type { Hex, Theme } from "./theme";

const SAMPLE: ReadyPlayer = {
  status: "ready",
  app: "spotify",
  state: "playing",
  track: {
    id: "sample",
    name: "The Ghost Domino",
    artist: "Kai Straw",
    album: "Night Bus Tapes",
    durationSec: 221,
    artwork: null,
  },
  positionSec: 72,
  volume: 72,
  shuffling: false,
  repeat: "all",
  repeatModes: ["off", "all", "one"],
};

const NO_ACTIONS: PlayerActions = {
  play() {}, pause() {}, toggle() {}, next() {}, previous() {},
  toggleShuffle() {}, cycleRepeat() {}, seek() {}, volumeInput() {}, volumeCommit() {},
};

/** A style drawn with the live track when one plays, else a sample. */
function Preview({
  style,
  appearance,
  player,
  theme,
  artworkUrl,
}: {
  style: PlayerStyle;
  appearance: Appearance;
  player: ReadyPlayer;
  theme: Theme;
  artworkUrl: string | null;
}) {
  const Style = STYLE_INFO[style].component;
  const accent = hasAccent(style)
    ? accentColor(style, appearance.accents[style], theme)
    : theme.primary;
  return (
    <div inert aria-hidden="true">
      <Style player={player} actions={NO_ACTIONS} theme={theme} accent={accent} artworkUrl={artworkUrl} />
    </div>
  );
}

/** The surface an accent sits on, for the contrast note. */
function accentSurface(style: AccentStyle, theme: Theme): Hex {
  if (style === "pocket") return surfaces(theme).card;
  if (style === "terminal") return terminalPalette(theme, theme.primary).bg;
  return style === "winamp" ? "#000000" : "#0e0d0b";
}

function shownAccent(style: AccentStyle, color: Hex, theme: Theme): Hex {
  if (style === "pocket") return pocketPalette(theme, color).line;
  if (style === "terminal") return terminalPalette(theme, color).hi;
  return lcdPalette(color, style === "winamp" ? "#000000" : "#0e0d0b").hi;
}

function Swatch({
  color,
  label,
  selected,
  onClick,
  marker,
}: {
  color: Hex;
  label: string;
  selected: boolean;
  onClick: () => void;
  marker?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex size-8 items-center justify-center rounded-full outline-offset-2 transition-transform hover:scale-105",
        selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
      )}
      style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1px #0000001f" }}
    >
      {marker ? <span className="size-1.5 rounded-full bg-black/45" /> : null}
    </button>
  );
}

function AccentPicker({
  style,
  appearance,
  theme,
  onChange,
}: {
  style: AccentStyle;
  appearance: Appearance;
  theme: Theme;
  onChange: (color: Hex | null) => void;
}) {
  const info = ACCENTS[style];
  const stored = appearance.accents[style];
  const current = accentColor(style, stored, theme);
  const fallback = accentColor(style, undefined, theme);
  const presets = PRESETS.filter((color) => color !== fallback);
  const [draft, setDraft] = useState(current.slice(1));
  useEffect(() => setDraft(current.slice(1)), [current]);

  const commitDraft = () => {
    const next = `#${draft.trim().replace(/^#/, "").toLowerCase()}`;
    if (isHex(next)) onChange(next);
    else setDraft(current.slice(1));
  };

  const shown = shownAccent(style, current, theme);
  const adjusted = shown !== current;
  const ratio = contrast(shown, accentSurface(style, theme));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Presets</p>
        <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2.5">
          <Swatch
            color={fallback}
            label={`${info.defaultLabel} (default)`}
            selected={stored === undefined}
            onClick={() => onChange(null)}
            marker
          />
          {presets.map((color) => (
            <Swatch
              key={color}
              color={color}
              label={color}
              selected={stored === color}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The dot marks the default: {info.defaultLabel.toLowerCase()}.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Custom</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border">
            <span className="sr-only">Pick a color</span>
            <span className="absolute inset-1.5 rounded" style={{ backgroundColor: current }} />
            <input
              type="color"
              value={current}
              onChange={(event) => onChange(event.target.value.toLowerCase() as Hex)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 font-mono text-sm">
            <span className="text-muted-foreground">#</span>
            <input
              aria-label="Hex color"
              value={draft}
              maxLength={7}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitDraft();
              }}
              className="w-[4.5rem] bg-transparent uppercase outline-none"
            />
          </div>
          {stored === undefined ? null : (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="h-9 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Reset to {info.defaultLabel.toLowerCase()}
            </button>
          )}
        </div>
      </div>

      <p role="status" className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
        {adjusted
          ? `This color is hard to read here, so the player adjusts it (now ${ratio.toFixed(1)}:1).`
          : `This color reads well on this theme (${ratio.toFixed(1)}:1).`}
      </p>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium text-foreground">{children}</p>;
}

export function PlayerStyleSettings() {
  const rpc = useRpc<typeof rpcContract>();
  // Accent saves wait 250 ms (a color input sends many changes while the
  // user drags). Each style has its own pending save.
  const pending = useRef(new Map<AccentStyle, { timer: number; color: Hex | null }>());
  const inFlight = useRef(0);
  const { appearance, setAppearance } = useAppearance(
    () => pending.current.size > 0 || inFlight.current > 0,
  );
  const theme = useTheme();
  // The panel polls once a second; the previews do not need that.
  const { player: live } = usePlayer(3000);
  const player = live?.status === "ready" && live.track !== null ? live : SAMPLE;
  const artworkUrl = useArtworkUrl(player.track?.artwork ?? null);
  const [error, setError] = useState<string | null>(null);

  const save = (patch: AppearancePatch) => {
    inFlight.current += 1;
    rpc
      .call("appearance_set", patch)
      .then(
        (next) => {
          // A newer local change wins over this reply.
          if (pending.current.size === 0 && inFlight.current === 1) setAppearance(next);
          setError(null);
        },
        (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)),
      )
      .finally(() => {
        inFlight.current -= 1;
      });
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  // Leaving the page sends the pending saves at once instead of losing them.
  useEffect(() => {
    const queue = pending.current;
    return () => {
      for (const [style, { timer, color }] of queue) {
        window.clearTimeout(timer);
        saveRef.current({ accent: style, color });
      }
      queue.clear();
    };
  }, []);

  if (appearance === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const pickStyle = (style: PlayerStyle) => {
    setAppearance({ ...appearance, style });
    save({ style });
  };
  const pickAccent = (style: AccentStyle, color: Hex | null) => {
    const accents = { ...appearance.accents };
    if (color === null) delete accents[style];
    else accents[style] = color;
    setAppearance({ ...appearance, accents });
    const queued = pending.current.get(style);
    if (queued !== undefined) window.clearTimeout(queued.timer);
    const timer = window.setTimeout(() => {
      pending.current.delete(style);
      save({ accent: style, color });
    }, 250);
    pending.current.set(style, { timer, color });
  };

  const { style } = appearance;
  const sidebar = surfaces(theme);

  return (
    <div className="space-y-6">
      <div
        role="radiogroup"
        aria-label="Player style"
        className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2"
      >
        {STYLES.map((option) => (
          // A div, not a button: the preview inside holds buttons of its own.
          <div
            key={option}
            role="radio"
            tabIndex={style === option ? 0 : -1}
            aria-checked={style === option}
            aria-label={STYLE_INFO[option].label}
            onClick={() => pickStyle(option)}
            onKeyDown={(event) => {
              const index = STYLES.indexOf(option);
              const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                pickStyle(option);
              } else if (step !== undefined) {
                event.preventDefault();
                const next = STYLES[(index + step + STYLES.length) % STYLES.length]!;
                pickStyle(next);
                const group = event.currentTarget.parentElement;
                requestAnimationFrame(() =>
                  group?.querySelector<HTMLElement>(`[aria-label="${STYLE_INFO[next].label}"]`)?.focus(),
                );
              }
            }}
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-[10px] border p-2 text-left outline-offset-2 transition-colors",
              style === option ? "border-foreground/60 bg-muted/40" : "border-border hover:bg-muted/30",
            )}
          >
            <span
              className="relative flex h-[72px] items-center justify-center overflow-hidden rounded-md"
              style={{ backgroundColor: sidebar.card }}
            >
              <span className="w-[258px] shrink-0 origin-center scale-[0.3]">
                <Preview style={option} appearance={appearance} player={player} theme={theme} artworkUrl={artworkUrl} />
              </span>
            </span>
            <span className="flex items-center justify-between text-xs font-medium text-foreground">
              {STYLE_INFO[option].label}
              {style === option ? <span aria-hidden="true">✓</span> : null}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_282px]">
        <div className="space-y-3">
          <Label>Accent</Label>
          {hasAccent(style) ? (
            <AccentPicker
              style={style}
              appearance={appearance}
              theme={theme}
              onChange={(color) => pickAccent(style, color)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {style === "cover"
                ? "Cover takes its colors from the album art."
                : `${STYLE_INFO[style].label} uses your bb theme's colors.`}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <Label>Preview</Label>
          <div className="rounded-xl border border-border p-3" style={{ backgroundColor: theme.canvas }}>
            <Preview style={style} appearance={appearance} player={player} theme={theme} artworkUrl={artworkUrl} />
          </div>
          {hasAccent(style) ? (
            <p className="text-xs text-muted-foreground">Each style keeps its own accent.</p>
          ) : null}
        </div>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
