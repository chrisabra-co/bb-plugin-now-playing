// Cover: the album art leads. The art sets the colors, so the card is the
// same in every theme.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bars,
  NextGlyph,
  NoteGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  RepeatGlyph,
  ShuffleGlyph,
} from "../glyphs";
import { REPEAT_LABELS, Scrub, formatTime } from "../player";
import type { StyleProps } from "./types";

export function CoverStyle({ player, actions, artworkUrl }: StyleProps) {
  const { appName, track, state, positionSec, shuffling, repeat } = player;
  const playing = state === "playing";
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [artworkUrl]);
  const art = artworkUrl !== null && !failed ? artworkUrl : null;
  const toggleClass = (on: boolean) =>
    cn("relative flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/10", on ? "text-white" : "text-white/65");

  return (
    <div className="relative isolate flex flex-col overflow-hidden rounded-[14px] bg-[#0c0c0c] text-white">
      {art === null ? null : (
        <img
          src={art}
          alt=""
          aria-hidden="true"
          className="absolute -inset-10 z-0 size-[calc(100%+80px)] max-w-none object-cover opacity-50 blur-[36px] saturate-150"
        />
      )}
      {/* One scrim across the art and the controls keeps the text legible
          and hides the edge where the art meets its blurred copy. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          backgroundImage:
            "linear-gradient(180deg, transparent 22%, rgb(12 12 12 / 0.55) 52%, rgb(12 12 12 / 0.82) 100%)",
        }}
      />
      <div className="relative flex aspect-[258/176] flex-col justify-end p-3.5">
        {art === null ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#111111]">
            <NoteGlyph className="size-12 text-white/30" />
          </div>
        ) : (
          <img
            src={art}
            alt=""
            onError={() => setFailed(true)}
            className="absolute inset-0 z-[1] size-full object-cover [mask-image:linear-gradient(to_bottom,#000_45%,transparent)]"
          />
        )}
        <div className="absolute left-3.5 top-3.5 z-[3] flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 backdrop-blur-sm">
          <Bars playing={playing} color="#ffffff" className="h-[10px]" />
          <span className="text-[10px] font-semibold uppercase leading-3 tracking-[0.08em]">
            {appName}
          </span>
        </div>
        <div className="relative z-[3] flex min-w-0 flex-col gap-0.5">
          <p className="line-clamp-2 text-[22px] font-bold leading-[26px] tracking-[-0.02em]">
            {track?.name ?? "Nothing playing"}
          </p>
          <p className="truncate text-[13px] leading-[18px] text-white/80">
            {track === null ? `Pick something in ${appName}` : track.artist}
          </p>
        </div>
      </div>

      <div className="relative z-[3] flex flex-col gap-2.5 px-3.5 pb-3.5 pt-2.5">
        {track === null ? null : (
          <div className="flex flex-col gap-1.5">
            <Scrub
              label="Seek"
              value={positionSec}
              max={track.durationSec}
              onCommit={actions.seek}
              className="-my-1.5 flex h-[15px] items-center"
            >
              {(_shown, percent) => (
                <div className="h-[3px] w-full rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
                </div>
              )}
            </Scrub>
            <div className="flex justify-between text-[10px] font-medium tabular-nums leading-3 text-white/70">
              <span>{formatTime(positionSec)}</span>
              <span>−{formatTime(track.durationSec - positionSec)}</span>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label={shuffling ? "Turn shuffle off" : "Turn shuffle on"}
            aria-pressed={shuffling}
            onClick={actions.toggleShuffle}
            className={toggleClass(shuffling)}
          >
            <ShuffleGlyph />
          </button>
          <button type="button" aria-label="Previous track" onClick={actions.previous} className={toggleClass(true)}>
            <PreviousGlyph className="size-[22px]" />
          </button>
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={actions.toggle}
            className="flex size-12 items-center justify-center rounded-full bg-white text-[#0c0c0c] transition-transform active:scale-95"
          >
            {playing ? <PauseGlyph className="size-5" /> : <PlayGlyph className="size-5" />}
          </button>
          <button type="button" aria-label="Next track" onClick={actions.next} className={toggleClass(true)}>
            <NextGlyph className="size-[22px]" />
          </button>
          <button
            type="button"
            aria-label={`${REPEAT_LABELS[repeat]}. Change repeat.`}
            aria-pressed={repeat !== "off"}
            onClick={actions.cycleRepeat}
            className={toggleClass(repeat !== "off")}
          >
            <RepeatGlyph />
            {repeat === "one" ? (
              <span className="absolute right-1 top-1 text-[8px] font-semibold leading-none">1</span>
            ) : null}
          </button>
        </div>
      </div>
    </div>
  );
}
