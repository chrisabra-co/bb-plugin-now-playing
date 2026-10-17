// bb-amp: a skin after the desktop MP3 players of around 2000. A skin keeps
// its own colors in every theme; the accent sets the color of the screen text.
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { APP_NAMES, Scrub, formatTime } from "../player";
import { lcdPalette } from "../theme";
import type { StyleProps } from "./types";

// Heights of the analyzer bars at rest, in px (the bars move while playing).
const SPECTRUM = [9, 13, 15, 11, 12, 8, 10, 6, 9, 7, 5, 7, 4, 5, 3, 2, 3, 2];

function Key({
  label,
  onClick,
  pressed,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("np-wa-key flex items-center justify-center", pressed && "np-wa-key-down", className)}
    >
      {children}
    </button>
  );
}

function Toggle({ label, caption, on, onClick }: { label: string; caption: string; on: boolean; onClick: () => void }) {
  return (
    <Key label={label} pressed={on} onClick={onClick} className="np-wa-toggle h-[15px] gap-[3px] px-[5px]">
      <span aria-hidden="true" className={cn("np-wa-led", on && "np-wa-led-on")} />
      <span aria-hidden="true" className="np-silk text-[6px] leading-2 tracking-[0.04em]">
        {caption}
      </span>
    </Key>
  );
}

export function BbampStyle({ player, actions, accent }: StyleProps) {
  const { app, track, state, positionSec, volume, shuffling, repeat } = player;
  const playing = state === "playing";
  const lcd = lcdPalette(accent, "#000000");
  const [remaining, setRemaining] = useState(false);
  const shownTime =
    track !== null && remaining
      ? `-${formatTime(track.durationSec - positionSec)}`
      : formatTime(positionSec);
  const title =
    track === null
      ? `BB-AMP - ${APP_NAMES[app].toUpperCase()}`
      : `1. ${track.artist} - ${track.name} (${formatTime(track.durationSec)})`.toUpperCase();
  const vars = { "--wa-lcd": lcd.hi, "--wa-lcd-dim": lcd.dim } as CSSProperties;

  return (
    <div className="np-wa flex flex-col gap-[3px] px-1 pb-[5px] pt-[3px]" style={vars}>
      <div aria-hidden="true" className="flex h-3 items-center gap-[5px]">
        <span className="np-wa-chip size-2 shrink-0" />
        <span className="np-wa-stripes h-[7px] flex-1" />
        <span className="np-silk text-[8px] leading-[10px] tracking-[0.12em] text-[#e6e6f2]">BB-AMP</span>
        <span className="np-wa-stripes h-[7px] flex-1" />
        <span className="flex shrink-0 gap-[2px]">
          <span className="np-wa-tiny size-2" />
          <span className="np-wa-tiny size-2" />
          <span className="np-wa-tiny size-2" />
        </span>
      </div>

      <div className="flex h-[46px] gap-1">
        <div className="np-wa-lcd flex w-[98px] shrink-0 gap-[3px] py-[3px] pl-0.5 pr-1">
          <div aria-hidden="true" className="np-silk flex w-1.5 shrink-0 flex-col justify-between text-[6px] leading-2 text-[#5c5c6e]">
            <span>O</span><span>A</span><span>I</span><span>D</span><span>V</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="flex h-[22px] items-center gap-1.5">
              <svg aria-hidden="true" width="6" height="8" viewBox="0 0 6 8" className="shrink-0">
                {playing ? (
                  <path d="M0 0L6 4L0 8Z" fill="var(--wa-lcd)" />
                ) : (
                  <g fill="var(--wa-lcd)">
                    <rect width="2" height="8" />
                    <rect x="4" width="2" height="8" />
                  </g>
                )}
              </svg>
              <button
                type="button"
                aria-label={remaining ? "Show time played" : "Show time left"}
                onClick={() => setRemaining((value) => !value)}
                className="np-vt text-[28px] leading-[22px] tracking-[0.04em] tabular-nums"
                style={{ color: lcd.hi }}
              >
                {shownTime}
              </button>
            </div>
            <div aria-hidden="true" className={cn("np-wa-spectrum flex h-[15px] items-end gap-px", playing && "np-wa-spectrum-on")}>
              {SPECTRUM.map((height, index) => (
                <span
                  key={index}
                  className="np-wa-bar w-[3px]"
                  style={{ height: playing ? height : 1, animationDelay: `${-index * 130}ms` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="np-wa-lcd flex h-[13px] items-center overflow-hidden px-[3px]">
            <div className={cn("np-wa-marquee flex shrink-0", playing && "np-wa-marquee-on")} style={{ animationDuration: `${Math.max(6, title.length * 0.22)}s` }}>
              <span className="np-silk whitespace-pre pr-6 text-[8px] leading-[10px]" style={{ color: lcd.hi }}>
                {title} ***
              </span>
              <span aria-hidden="true" className="np-silk whitespace-pre pr-6 text-[8px] leading-[10px]" style={{ color: lcd.hi }}>
                {title} ***
              </span>
            </div>
          </div>
          <div className="np-silk flex h-2.5 items-center gap-[3px] text-[6px] leading-2">
            <span className="np-wa-lcd flex h-2.5 items-center px-[3px] text-[7px]" style={{ color: lcd.hi }}>
              {app === "spotify" ? "SPOTIFY" : "MUSIC"}
            </span>
            <span className="flex-1" />
            <span aria-hidden="true" className="text-[#4a4a5e]">MONO</span>
            <span aria-hidden="true" style={{ color: lcd.hi }}>STEREO</span>
          </div>
          <div className="flex h-3 items-center gap-[3px]">
            <Scrub
              label="Volume"
              value={volume}
              max={100}
              onInput={actions.volumeInput}
              onCommit={actions.volumeCommit}
              className="flex h-3 min-w-0 flex-[54] items-center"
            >
              {(_shown, percent) => (
                <>
                  <span className="np-wa-volume h-1.5 w-full" style={{ "--wa-volume": `${percent}%` } as CSSProperties} />
                  <span className="np-wa-thumb absolute top-px h-2.5 w-3" style={{ left: `calc((100% - 12px) * ${percent / 100})` }} />
                </>
              )}
            </Scrub>
            <span aria-hidden="true" className="relative flex h-3 min-w-0 flex-[28] items-center">
              <span className="np-wa-groove h-1.5 w-full bg-[#1f6a1f]" />
              <span className="np-wa-thumb absolute left-[calc(50%-6px)] top-px h-2.5 w-3" />
            </span>
            <span className="flex-1" />
            <span aria-hidden="true" className="np-wa-small flex h-[11px] w-5 shrink-0 items-center justify-center gap-0.5">
              <span className="h-[5px] w-0.5" style={{ backgroundColor: lcd.hi }} />
              <span className="np-silk text-[6px] leading-2 text-[#d6d6e6]">EQ</span>
            </span>
            <span aria-hidden="true" className="np-wa-small flex h-[11px] w-5 shrink-0 items-center justify-center gap-0.5">
              <span className="h-[5px] w-0.5" style={{ backgroundColor: lcd.dim }} />
              <span className="np-silk text-[6px] leading-2 text-[#d6d6e6]">PL</span>
            </span>
          </div>
        </div>
      </div>

      {track === null ? (
        <div className="flex h-2.5 items-center"><span className="np-wa-groove h-1.5 w-full bg-[#15151f]" /></div>
      ) : (
        <Scrub
          label="Seek"
          value={positionSec}
          max={track.durationSec}
          onCommit={actions.seek}
          className="flex h-2.5 items-center"
        >
          {(_shown, percent) => (
            <>
              <span className="np-wa-groove h-1.5 w-full bg-[#15151f]" />
              <span className="np-wa-thumb absolute top-0 h-2.5 w-7" style={{ left: `calc((100% - 28px) * ${percent / 100})` }} />
            </>
          )}
        </Scrub>
      )}

      <div className="flex h-5 items-center gap-[5px]">
        <div className="flex border border-[#05050a]">
          <Key label="Previous track" onClick={actions.previous} className="h-[18px] w-[22px]">
            <svg aria-hidden="true" width="10" height="8" viewBox="0 0 10 8"><rect width="2" height="8" fill="#16161f" /><path d="M10 0L3 4L10 8Z" fill="#16161f" /></svg>
          </Key>
          <Key label="Play" onClick={actions.play} pressed={playing} className="h-[18px] w-[22px]">
            <svg aria-hidden="true" width="7" height="8" viewBox="0 0 7 8"><path d="M0 0L7 4L0 8Z" fill="#16161f" /></svg>
          </Key>
          <Key label="Pause" onClick={actions.pause} pressed={state === "paused"} className="h-[18px] w-[22px]">
            <svg aria-hidden="true" width="7" height="8" viewBox="0 0 7 8"><rect width="2.5" height="8" fill="#16161f" /><rect x="4.5" width="2.5" height="8" fill="#16161f" /></svg>
          </Key>
          <Key label="Stop" onClick={actions.pause} className="h-[18px] w-[22px]">
            <svg aria-hidden="true" width="7" height="7" viewBox="0 0 7 7"><rect width="7" height="7" fill="#16161f" /></svg>
          </Key>
          <Key label="Next track" onClick={actions.next} className="h-[18px] w-[22px]">
            <svg aria-hidden="true" width="10" height="8" viewBox="0 0 10 8"><path d="M0 0L7 4L0 8Z" fill="#16161f" /><rect x="8" width="2" height="8" fill="#16161f" /></svg>
          </Key>
        </div>
        <Toggle
          label={shuffling ? "Turn shuffle off" : "Turn shuffle on"}
          caption="SHUFFLE"
          on={shuffling}
          onClick={actions.toggleShuffle}
        />
        <Toggle
          label={`Repeat is ${repeat}. Change repeat.`}
          caption={repeat === "one" ? "REP 1" : "REP"}
          on={repeat !== "off"}
          onClick={actions.cycleRepeat}
        />
        <span className="flex-1" />
        <svg aria-hidden="true" width="12" height="14" viewBox="0 0 12 14" className="shrink-0">
          <path d="M4 2V11M4 2L11 0V9" fill="none" stroke="#d9bc62" strokeWidth="2" />
          <rect x="0" y="9" width="5" height="5" fill="#d9bc62" />
          <rect x="7" y="7" width="5" height="5" fill="#d9bc62" />
        </svg>
      </div>
    </div>
  );
}
