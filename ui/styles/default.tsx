// Default: the original panel, drawn with bb's own theme tokens.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  NextGlyph,
  NoteGlyph,
  PauseGlyph,
  PlayGlyph,
  PreviousGlyph,
  RepeatGlyph,
  ShuffleGlyph,
  VolumeGlyph,
} from "../glyphs";
import { REPEAT_LABELS, Scrub, formatTime } from "../player";
import type { StyleProps } from "./types";

export function Artwork({ url, className }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div
      className={cn(
        "flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted",
        className,
      )}
    >
      {url !== null && !failed ? (
        <img src={url} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <NoteGlyph className="text-muted-foreground" />
      )}
    </div>
  );
}

function ThinSlider(props: {
  label: string;
  value: number;
  max: number;
  onInput?: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  return (
    <Scrub {...props} className="group flex h-4 flex-1 items-center">
      {(_shown, percent) => (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground/70 group-hover:bg-foreground"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </Scrub>
  );
}

function ControlButton({
  label,
  onClick,
  active,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "size-8 text-muted-foreground hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      {children}
    </Button>
  );
}

export function DefaultStyle({ player, actions, artworkUrl }: StyleProps) {
  const { appName, track, state, positionSec, volume, shuffling, repeat } = player;
  const playing = state === "playing";
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <Artwork url={artworkUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {track?.name ?? "Nothing playing"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {track === null ? `Pick something in ${appName}` : track.artist}
          </p>
          <p className="truncate text-[10px] text-muted-foreground/70">{appName}</p>
        </div>
      </div>

      {track === null ? null : (
        <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-muted-foreground">
          <span className="w-8 text-right">{formatTime(positionSec)}</span>
          <ThinSlider
            label="Seek"
            value={positionSec}
            max={track.durationSec}
            onCommit={actions.seek}
          />
          <span className="w-8">{formatTime(track.durationSec)}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <ControlButton
          label={shuffling ? "Turn shuffle off" : "Turn shuffle on"}
          active={shuffling}
          onClick={actions.toggleShuffle}
        >
          <ShuffleGlyph />
        </ControlButton>
        <ControlButton label="Previous track" onClick={actions.previous}>
          <PreviousGlyph />
        </ControlButton>
        <Button
          size="icon"
          aria-label={playing ? "Pause" : "Play"}
          onClick={actions.toggle}
          className="size-9 rounded-full"
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </Button>
        <ControlButton label="Next track" onClick={actions.next}>
          <NextGlyph />
        </ControlButton>
        <ControlButton
          label={`${REPEAT_LABELS[repeat]}. Change repeat.`}
          active={repeat !== "off"}
          onClick={actions.cycleRepeat}
          className="relative"
        >
          <RepeatGlyph />
          {repeat === "one" ? (
            <span className="absolute right-1 top-1 text-[8px] font-semibold leading-none">1</span>
          ) : null}
        </ControlButton>
      </div>

      {volume === null ? null : (
        <div className="flex items-center gap-2">
          <VolumeGlyph muted={volume === 0} className="text-muted-foreground" />
          <ThinSlider
            label="Volume"
            value={volume}
            max={100}
            onInput={actions.volumeInput}
            onCommit={actions.volumeCommit}
          />
        </div>
      )}
    </div>
  );
}
