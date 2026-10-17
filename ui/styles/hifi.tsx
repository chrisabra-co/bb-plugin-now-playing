// Hi-Fi: a deck with an LCD lit in the accent. The screen stays dark in
// every theme; the case and keys follow the theme.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from "react";
import {
  NextGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  RepeatGlyph,
  ShuffleGlyph,
} from "../glyphs";
import { REPEAT_LABELS, Scrub, formatTime } from "../player";
import { hifiPalette } from "../theme";
import type { StyleProps } from "./types";

const SEGMENTS = 22;
const APP_CODES = { spotify: "SP", music: "AM", other: "MP" } as const;

type Palette = ReturnType<typeof hifiPalette>;

function Key({
  label,
  caption,
  onClick,
  led,
  palette,
  grow = 1,
  pressed,
  children,
}: {
  label: string;
  caption: string;
  onClick: () => void;
  led?: boolean;
  palette: Palette;
  grow?: number;
  pressed?: boolean;
  children: ReactNode;
}) {
  const { lcd } = palette;
  return (
    <div className="flex min-w-0 basis-0 flex-col items-center gap-[5px]" style={{ flexGrow: grow }}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className="np-hifi-key relative flex h-[30px] w-full items-center justify-center gap-[5px] rounded-[4px] border"
        style={{
          backgroundImage: `linear-gradient(180deg, ${palette.key1}, ${palette.key2})`,
          borderColor: palette.keyBorder,
          color: palette.glyph,
          boxShadow: palette.dark
            ? "inset 0 1px 0 #ffffff21, inset 0 -2px 0 #00000066"
            : "inset 0 1px 0 #ffffffcc, inset 0 -2px 0 #0000001f",
        }}
      >
        {children}
        {led === undefined ? null : (
          <span
            aria-hidden="true"
            className="absolute left-[5px] top-1 size-1 rounded-full"
            style={{
              backgroundColor: led ? lcd.hi : lcd.dim,
              boxShadow: led ? `0 0 5px ${lcd.hi}e6` : undefined,
            }}
          />
        )}
      </button>
      <span
        aria-hidden="true"
        className="text-[8px] font-semibold leading-[10px] tracking-[0.12em]"
        style={{ color: palette.label }}
      >
        {caption}
      </span>
    </div>
  );
}

/** Drag up or down, scroll, or use the arrow keys to turn the volume. */
function Knob({
  volume,
  onInput,
  onCommit,
  palette,
}: {
  volume: number;
  onInput: (volume: number) => void;
  onCommit: (volume: number) => void;
  palette: Palette;
}) {
  const [draft, setDraftState] = useState<number | null>(null);
  // Refs hold the latest values for native and pointer handlers.
  const draftRef = useRef<number | null>(null);
  const drag = useRef<{ y: number; start: number } | null>(null);
  const wheelTimer = useRef<number | null>(null);
  const knob = useRef<HTMLDivElement>(null);
  const latest = useRef({ volume, onInput, onCommit });
  latest.current = { volume, onInput, onCommit };
  const shown = draft ?? volume;
  const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
  const setDraft = (next: number | null) => {
    draftRef.current = next;
    setDraftState(next);
  };
  const change = (next: number) => {
    setDraft(next);
    latest.current.onInput(next);
  };
  const finish = () => {
    if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
    wheelTimer.current = null;
    if (draftRef.current !== null) latest.current.onCommit(draftRef.current);
    setDraft(null);
  };

  // React wheel listeners are passive, so the sidebar would scroll too.
  useEffect(() => {
    const node = knob.current;
    if (node === null) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const base = draftRef.current ?? latest.current.volume;
      change(clamp(base - Math.sign(event.deltaY) * 2));
      if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(finish, 300);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
    };
    // change and finish only read refs.
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, start: shown };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    if (event.buttons === 0) {
      onPointerUp();
      return;
    }
    change(clamp(drag.current.start + (drag.current.y - event.clientY) / 1.5));
  };
  const onPointerUp = () => {
    if (drag.current === null) return;
    drag.current = null;
    finish();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 10, PageDown: -10,
    };
    if (event.key === "Home") change(0);
    else if (event.key === "End") change(100);
    else if (steps[event.key] !== undefined) change(clamp(shown + steps[event.key]!));
    else return;
    event.preventDefault();
  };
  // The dot turns from 7 o'clock (0) to 5 o'clock (100).
  const angle = -135 + (shown / 100) * 270;
  return (
    <div className="flex w-[34px] shrink-0 flex-col items-center gap-[3px]">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onKeyUp={finish}
        onBlur={finish}
        ref={knob}
        className="relative size-8 cursor-ns-resize touch-none rounded-full border outline-offset-2"
        style={{
          backgroundImage: `radial-gradient(circle at 35% 28%, ${palette.knob1}, ${palette.knob2} 100%)`,
          borderColor: palette.keyBorder,
          boxShadow: palette.dark
            ? "inset 0 1px 0 #ffffff1f, 0 2px 4px #0000008c"
            : "inset 0 1px 0 #ffffffcc, 0 2px 4px #00000026",
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-[6px] rounded-full"
          style={{
            backgroundImage: `radial-gradient(circle at 40% 35%, ${palette.knob1}, ${palette.knob2})`,
            boxShadow: palette.dark ? "inset 0 1px 1px #00000099" : "inset 0 1px 1px #00000033",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <span
            className="absolute left-1/2 top-[3px] size-[3px] -translate-x-1/2 rounded-full"
            style={{ backgroundColor: palette.lcd.hi, boxShadow: `0 0 4px ${palette.lcd.hi}e6` }}
          />
        </span>
      </div>
      <span
        aria-hidden="true"
        className="text-[8px] font-semibold leading-[10px] tracking-[0.12em]"
        style={{ color: palette.label }}
      >
        VOL
      </span>
    </div>
  );
}

export function HiFiStyle({ player, actions, theme, accent }: StyleProps) {
  const { app, track, state, positionSec, volume, shuffling, repeat } = player;
  const playing = state === "playing";
  const palette = hifiPalette(theme, accent);
  const { lcd } = palette;
  const dot = (lit: boolean): CSSProperties => ({ color: lit ? lcd.hi : lcd.dim });
  const glow = { textShadow: `0 0 8px ${lcd.glow}` };
  return (
    <div
      className="np-hifi flex flex-col gap-2.5 rounded-[10px] border p-2.5"
      style={{
        backgroundImage: `linear-gradient(180deg, ${palette.body1}, ${palette.body2})`,
        borderColor: palette.bodyBorder,
        boxShadow: palette.dark ? "inset 0 1px 0 #ffffff0f" : "inset 0 1px 0 #ffffffb3",
      }}
    >
      <div
        className="flex flex-col gap-1.5 rounded-md border border-black px-3 pb-3 pt-2.5"
        style={{ backgroundColor: lcd.screen, boxShadow: "inset 0 2px 8px #000000cc" }}
      >
        <div className="np-doto flex justify-between text-[10px] font-bold leading-3 tracking-[0.06em]">
          <span style={dot(true)}>{APP_CODES[app]}</span>
          <span style={dot(shuffling)}>SHUF</span>
          <span style={dot(repeat !== "off")}>RPT·{repeat === "one" ? "ONE" : repeat === "all" ? "ALL" : "OFF"}</span>
          <span style={{ color: lcd.mid }}>VOL {volume === null ? "--" : String(volume).padStart(2, "0")}</span>
        </div>
        <div className="np-doto flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-[14px] font-black uppercase leading-5 tracking-[0.01em]" style={{ color: lcd.hi, ...glow }}>
              {track?.name ?? "No disc"}
            </p>
            <p className="truncate text-[11px] font-bold uppercase leading-[14px] tracking-[0.08em]" style={{ color: lcd.mid }}>
              {track?.artist ?? "Press play"}
            </p>
          </div>
          <span className="shrink-0 text-[24px] font-black tabular-nums leading-6" style={{ color: lcd.hi, ...glow }}>
            {formatTime(positionSec)}
          </span>
        </div>
        {track === null ? null : (
          <Scrub
            label="Seek"
            value={positionSec}
            max={track.durationSec}
            onCommit={actions.seek}
            className="-mb-1 pb-1 pt-1"
          >
            {(_shown, percent) => {
              const lit = Math.round((percent / 100) * SEGMENTS);
              return (
                <div className="flex gap-[2px]">
                  {Array.from({ length: SEGMENTS }, (_, index) => (
                    <span
                      key={index}
                      className="h-[5px] flex-1"
                      style={{ backgroundColor: index < lit ? lcd.hi : lcd.dim }}
                    />
                  ))}
                </div>
              );
            }}
          </Scrub>
        )}
      </div>

      <div className="flex items-start gap-2 px-0.5 pt-0.5">
        <div className="flex min-w-0 flex-1 gap-1">
          <Key
            label={shuffling ? "Turn shuffle off" : "Turn shuffle on"}
            caption="SHUF"
            pressed={shuffling}
            led={shuffling}
            onClick={actions.toggleShuffle}
            palette={palette}
          >
            <ShuffleGlyph className="size-3" strokeWidth={2.2} />
          </Key>
          <Key label="Previous track" caption="PREV" onClick={actions.previous} palette={palette}>
            <PreviousGlyph className="size-3" />
          </Key>
          <Key
            label={playing ? "Pause" : "Play"}
            caption="PLAY"
            led={playing}
            grow={1.5}
            onClick={actions.toggle}
            palette={palette}
          >
            <PlayGlyph className="size-[11px]" />
            <PauseGlyph className="size-[11px]" />
          </Key>
          <Key label="Next track" caption="NEXT" onClick={actions.next} palette={palette}>
            <NextGlyph className="size-3" />
          </Key>
          <Key
            label={`${REPEAT_LABELS[repeat]}. Change repeat.`}
            caption={repeat === "one" ? "RPT 1" : "RPT"}
            pressed={repeat !== "off"}
            led={repeat !== "off"}
            onClick={actions.cycleRepeat}
            palette={palette}
          >
            <RepeatGlyph className="size-3" strokeWidth={2.2} />
          </Key>
        </div>
        {volume === null ? null : (
          <Knob
            volume={volume}
            onInput={actions.volumeInput}
            onCommit={actions.volumeCommit}
            palette={palette}
          />
        )}
      </div>
    </div>
  );
}
