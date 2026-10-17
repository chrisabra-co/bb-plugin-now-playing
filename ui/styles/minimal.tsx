// Minimal: the title, a hairline, and the time. Controls show on hover.
import { Bars, NextGlyph, PauseGlyph, PlayGlyph, PreviousGlyph } from "../glyphs";
import { Scrub, formatTime } from "../player";
import { mix, surfaces } from "../theme";
import type { StyleProps } from "./types";

export function MinimalStyle({ player, actions, theme }: StyleProps) {
  const { appName, track, state, positionSec } = player;
  const playing = state === "playing";
  const colors = surfaces(theme);
  const chip = mix(theme.ink, theme.canvas, theme.dark ? 0.1 : 0.08);
  const iconButton = "flex size-6 items-center justify-center rounded-md transition-colors";
  return (
    <div className="np-min flex flex-col gap-[9px] px-1 py-0.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-px">
          <p
            className="truncate text-[14px] font-semibold leading-[18px] tracking-[-0.01em]"
            style={{ color: colors.text }}
          >
            {track?.name ?? "Nothing playing"}
          </p>
          <p className="truncate text-[12px] leading-4" style={{ color: colors.muted }}>
            {track === null ? `Pick something in ${appName}` : track.artist}
          </p>
        </div>
        {/* The time and the controls share one spot; CSS swaps them. */}
        <div className="grid shrink-0 justify-items-end">
          <div className="np-min-rest flex h-6 items-center gap-[7px] [grid-area:1/1]">
            <Bars playing={playing} color={colors.muted} />
            <span className="font-mono text-[10px] tabular-nums" style={{ color: colors.muted }}>
              {formatTime(positionSec)}
            </span>
          </div>
          <div className="np-min-controls flex items-center gap-0.5 [grid-area:1/1]" style={{ color: colors.muted }}>
            <button type="button" aria-label="Previous track" onClick={actions.previous} className={iconButton}>
              <PreviousGlyph className="size-3" />
            </button>
            <button
              type="button"
              aria-label={playing ? "Pause" : "Play"}
              onClick={actions.toggle}
              className={iconButton}
              style={{ backgroundColor: chip, color: colors.text }}
            >
              {playing ? <PauseGlyph className="size-3" /> : <PlayGlyph className="size-3" />}
            </button>
            <button type="button" aria-label="Next track" onClick={actions.next} className={iconButton}>
              <NextGlyph className="size-3" />
            </button>
          </div>
        </div>
      </div>
      {track === null ? (
        <div className="h-px" style={{ backgroundColor: colors.track }} />
      ) : (
        <Scrub
          label="Seek"
          value={positionSec}
          max={track.durationSec}
          onCommit={actions.seek}
          className="-my-1.5 flex h-[13px] items-center"
        >
          {(_shown, percent) => (
            <div className="relative h-px w-full" style={{ backgroundColor: colors.track }}>
              <div className="h-px" style={{ width: `${percent}%`, backgroundColor: colors.text }} />
              <div
                className="np-min-dot absolute top-[-3px] size-[7px] rounded-full"
                style={{ left: `calc(${percent}% - 3.5px)`, backgroundColor: colors.text }}
              />
            </div>
          )}
        </Scrub>
      )}
    </div>
  );
}
