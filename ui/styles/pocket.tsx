// Pocket: one slim row. The play key and progress line use the accent.
import { useEffect, useState } from "react";
import { NextGlyph, NoteGlyph, PauseGlyph, PlayGlyph } from "../glyphs";
import { APP_NAMES, Scrub } from "../player";
import { pocketPalette } from "../theme";
import type { StyleProps } from "./types";

export function PocketStyle({ player, actions, theme, accent, artworkUrl }: StyleProps) {
  const { app, track, state, positionSec } = player;
  const playing = state === "playing";
  const colors = pocketPalette(theme, accent);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [artworkUrl]);
  return (
    <div
      className="relative flex h-14 items-center gap-2.5 overflow-hidden rounded-xl border px-2"
      style={{ backgroundColor: colors.card, borderColor: colors.border }}
    >
      <div
        className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ backgroundColor: colors.track, color: colors.muted }}
      >
        {artworkUrl !== null && !failed ? (
          <img src={artworkUrl} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <NoteGlyph className="size-4" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[13px] font-semibold leading-[17px] tracking-[-0.01em]" style={{ color: colors.text }}>
          {track?.name ?? "Nothing playing"}
        </p>
        <p className="truncate text-[11px] leading-[15px]" style={{ color: colors.muted }}>
          {track === null ? APP_NAMES[app] : track.artist}
        </p>
      </div>
      <button
        type="button"
        aria-label="Next track"
        onClick={actions.next}
        className="flex size-7 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-70"
        style={{ color: colors.text }}
      >
        <NextGlyph />
      </button>
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={actions.toggle}
        className="flex size-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{ backgroundColor: colors.fill, color: colors.glyph }}
      >
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </button>
      {track === null ? null : (
        <Scrub
          label="Seek"
          value={positionSec}
          max={track.durationSec}
          onCommit={actions.seek}
          className="absolute inset-x-0 bottom-0 flex h-2 items-end"
        >
          {(_shown, percent) => (
            <div className="h-0.5 w-full" style={{ backgroundColor: colors.track }}>
              <div className="h-full" style={{ width: `${percent}%`, backgroundColor: colors.line }} />
            </div>
          )}
        </Scrub>
      )}
    </div>
  );
}
