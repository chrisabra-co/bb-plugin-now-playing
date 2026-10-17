// Terminal: the player as a shell session. It follows the theme's light or
// dark mode, and its text uses the accent, checked for contrast.
import { APP_NAMES, Scrub, formatTime } from "../player";
import { terminalPalette } from "../theme";
import type { StyleProps } from "./types";

const BAR_CELLS = 20;
const VOLUME_CELLS = 10;

const cells = (percent: number, count: number, on: string, off: string) => {
  const lit = Math.round((percent / 100) * count);
  return on.repeat(lit) + off.repeat(count - lit);
};

export function TerminalStyle({ player, actions, theme, accent }: StyleProps) {
  const { app, track, state, positionSec, volume, shuffling, repeat } = player;
  const playing = state === "playing";
  const colors = terminalPalette(theme, accent);
  const glow = colors.dark ? { textShadow: `0 0 6px ${colors.hi}73` } : undefined;
  const outline = { borderColor: colors.line, color: colors.hi };
  const textButton = "rounded-[3px] transition-opacity hover:opacity-80";
  return (
    <div
      className="np-mono flex flex-col gap-2.5 rounded-lg border p-3 text-[11px] leading-4"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        boxShadow: colors.dark ? `inset 0 0 24px ${colors.hi}0f` : undefined,
      }}
    >
      <p className="truncate" style={{ color: colors.low }}>
        ~/music $ now-playing --watch
      </p>
      <div className="flex min-w-0 flex-col">
        <p className="truncate font-bold lowercase" style={{ color: colors.hi, ...glow }}>
          {playing ? "▶" : "■"} {track?.name ?? "nothing playing"}
        </p>
        <p className="truncate whitespace-pre lowercase" style={{ color: colors.mid }}>
          {"  "}
          {track === null ? `open a song in ${APP_NAMES[app]}` : `${track.artist} · ${APP_NAMES[app]}`}
        </p>
      </div>
      {track === null ? null : (
        <div className="flex items-center justify-between gap-2">
          <Scrub
            label="Seek"
            value={positionSec}
            max={track.durationSec}
            onCommit={actions.seek}
            className="min-w-0"
          >
            {(_shown, percent) => (
              <span className="whitespace-pre" style={{ color: colors.hi }}>
                [{cells(percent, BAR_CELLS, "#", "-")}]
              </span>
            )}
          </Scrub>
          <span className="tabular-nums" style={{ color: colors.mid }}>
            {formatTime(positionSec)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2" style={{ color: colors.mid }}>
        <button
          type="button"
          aria-label={shuffling ? "Turn shuffle off" : "Turn shuffle on"}
          aria-pressed={shuffling}
          onClick={actions.toggleShuffle}
          className={textButton}
          style={shuffling ? { color: colors.hi } : undefined}
        >
          shuf:{shuffling ? "on" : "off"}
        </button>
        <button
          type="button"
          aria-label={`Repeat is ${repeat}. Change repeat.`}
          aria-pressed={repeat !== "off"}
          onClick={actions.cycleRepeat}
          className={textButton}
          style={repeat !== "off" ? { color: colors.hi } : undefined}
        >
          rpt:{repeat}
        </button>
        <Scrub
          label="Volume"
          value={volume}
          max={100}
          onInput={actions.volumeInput}
          onCommit={actions.volumeCommit}
        >
          {(_shown, percent) => (
            <span className="whitespace-pre">vol:{cells(percent, VOLUME_CELLS, "|", ".")}</span>
          )}
        </Scrub>
      </div>
      <div className="flex gap-1.5 pt-0.5">
        <button
          type="button"
          aria-label="Previous track"
          onClick={actions.previous}
          className="flex-1 rounded-[3px] border py-[5px] text-center transition-opacity hover:opacity-80"
          style={outline}
        >
          « prev
        </button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={actions.toggle}
          className="flex-[1.3] rounded-[3px] py-[5px] text-center font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: colors.hi, color: colors.onHi }}
        >
          {playing ? "|| pause" : "> play"}
        </button>
        <button
          type="button"
          aria-label="Next track"
          onClick={actions.next}
          className="flex-1 rounded-[3px] border py-[5px] text-center transition-opacity hover:opacity-80"
          style={outline}
        >
          next »
        </button>
      </div>
    </div>
  );
}
