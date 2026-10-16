// bb-plugin-now-playing — a small Spotify or Apple Music player in the
// sidebar footer.
//
// Compiled by `bb plugin build` into dist/app.js + dist/app.css. React and
// @get-bb/plugin-sdk/app come from the BB app at load time.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { definePluginApp, useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type {
  Control,
  MusicApp,
  Player,
  RepeatMode,
  Track,
  rpcContract,
} from "./server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_MS = 1000;

const APP_NAMES: Record<MusicApp, string> = {
  spotify: "Spotify",
  music: "Apple Music",
};

/** Polls the player while the panel is open and the page is visible. */
function usePlayer() {
  const rpc = useRpc<typeof rpcContract>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const apply = useCallback((next: Player) => {
    setPlayer(next);
    setError(null);
  }, []);
  const report = useCallback((cause: unknown) => {
    setError(cause instanceof Error ? cause.message : String(cause));
  }, []);

  const refresh = useCallback(() => {
    if (inFlight.current || document.visibilityState !== "visible") return;
    inFlight.current = true;
    rpc
      .call("player_state")
      .then(apply, report)
      .finally(() => {
        inFlight.current = false;
      });
  }, [rpc, apply, report]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);
  useRealtime("player-changed", refresh);

  const send = useCallback(
    (control: Control) => {
      rpc.call("player_control", control).then(apply, report);
    },
    [rpc, apply, report],
  );

  return { player, error, send };
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// Plugin-owned glyphs: BB's icon set has no media controls.
function Glyph({ children, className }: { children: ReactNode; className?: string }) {
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
const PlayGlyph = () => (
  <Glyph>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </Glyph>
);
const PauseGlyph = () => (
  <Glyph>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Glyph>
);
const NextGlyph = () => (
  <Glyph>
    <path d="M5 6.2v11.6a1 1 0 0 0 1.53.85l8.7-5.8a1 1 0 0 0 0-1.7l-8.7-5.8A1 1 0 0 0 5 6.2Z" />
    <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
  </Glyph>
);
const PreviousGlyph = () => (
  <Glyph>
    <path d="M19 6.2v11.6a1 1 0 0 1-1.53.85l-8.7-5.8a1 1 0 0 1 0-1.7l8.7-5.8A1 1 0 0 1 19 6.2Z" />
    <rect x="5" y="5" width="2.5" height="14" rx="1" />
  </Glyph>
);
const ShuffleGlyph = () => (
  <Glyph>
    <path
      d="M3 7h3.5c2 0 3 1 4.2 3.2l2.6 4.6C14.5 17 15.5 18 17.5 18H21M3 18h3.5c1.4 0 2.3-.5 3.1-1.5M14.4 8.5c.8-1 1.7-1.5 3.1-1.5H21M18.5 4.5 21 7l-2.5 2.5M18.5 15.5 21 18l-2.5 2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Glyph>
);
const RepeatGlyph = () => (
  <Glyph>
    <path
      d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M17 3l3 3-3 3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4M7 21l-3-3 3-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Glyph>
);
const VolumeGlyph = ({ muted }: { muted: boolean }) => (
  <Glyph className="size-3.5 text-muted-foreground">
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
const NoteGlyph = () => (
  <Glyph className="size-5 text-muted-foreground">
    <path d="M9 17.5V6.2a1 1 0 0 1 .76-.97l9-2.2A1 1 0 0 1 20 4v11.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="6.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="15.5" r="2.5" />
  </Glyph>
);

/**
 * A thin theme-colored slider. The native range input stays on top, so
 * pointer, touch, and keyboard input work without custom handling.
 * `onCommit` fires when the user releases the thumb or uses the keyboard.
 */
function Slider({
  label,
  value,
  max,
  step = 1,
  onInput,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onInput?: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const percent = max > 0 ? Math.min(100, (shown / max) * 100) : 0;
  const commit = () => {
    if (draft === null) return;
    onCommit(draft);
    setDraft(null);
  };
  return (
    <div className="group relative flex h-4 flex-1 items-center">
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70 group-hover:bg-foreground"
          style={{ width: `${percent}%` }}
        />
      </div>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={max}
        step={step}
        value={shown}
        onChange={(event) => {
          const next = Number(event.target.value);
          setDraft(next);
          onInput?.(next);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
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

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="space-y-2 py-1 text-xs text-muted-foreground">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Spotify artwork is a URL. Music artwork loads once per track over RPC. */
function useArtworkUrl(artwork: Track["artwork"]): string | null {
  const rpc = useRpc<typeof rpcContract>();
  const key = artwork?.kind === "music" ? artwork.key : null;
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null);
  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    rpc.call("player_artwork", { key }).then(
      ({ url }) => {
        if (!cancelled) setLoaded({ key, url });
      },
      () => {
        if (!cancelled) setLoaded({ key, url: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [rpc, key]);
  if (artwork === null) return null;
  if (artwork.kind === "url") return artwork.url;
  return loaded?.key === artwork.key ? loaded.url : null;
}

function Artwork({ artwork }: { artwork: Track["artwork"] }) {
  const url = useArtworkUrl(artwork);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
      {url !== null && url !== "" && !failed ? (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <NoteGlyph />
      )}
    </div>
  );
}

const REPEAT_LABELS: Record<RepeatMode, string> = {
  off: "Repeat is off",
  all: "Repeating all",
  one: "Repeating one track",
};

function PlayerView({
  player,
  send,
}: {
  player: Extract<Player, { status: "ready" }>;
  send: (control: Control) => void;
}) {
  const { app, track, state, positionSec, volume, shuffling, repeat, repeatModes } =
    player;
  const playing = state === "playing";
  const nextRepeat =
    repeatModes[(repeatModes.indexOf(repeat) + 1) % repeatModes.length] ?? "off";

  // The app applies volume at once, so send it while dragging, at most
  // every 150 ms, and always send the final value.
  const volumeTimer = useRef<number | null>(null);
  const pendingVolume = useRef<number | null>(null);
  useEffect(() => () => {
    if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current);
  }, []);
  const flushVolume = () => {
    volumeTimer.current = null;
    if (pendingVolume.current === null) return;
    send({ action: "volume", volume: pendingVolume.current });
    pendingVolume.current = null;
  };
  const queueVolume = (next: number) => {
    pendingVolume.current = Math.round(next);
    if (volumeTimer.current === null) {
      volumeTimer.current = window.setTimeout(flushVolume, 150);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <Artwork artwork={track?.artwork ?? null} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {track?.name ?? "Nothing playing"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {track === null ? `Pick something in ${APP_NAMES[app]}` : track.artist}
          </p>
          <p className="truncate text-[10px] text-muted-foreground/70">
            {APP_NAMES[app]}
          </p>
        </div>
      </div>

      {track === null ? null : (
        <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-muted-foreground">
          <span className="w-8 text-right">{formatTime(positionSec)}</span>
          <Slider
            label="Seek"
            value={positionSec}
            max={track.durationSec}
            onCommit={(next) => send({ action: "seek", positionSec: next })}
          />
          <span className="w-8">{formatTime(track.durationSec)}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <ControlButton
          label={shuffling ? "Turn shuffle off" : "Turn shuffle on"}
          active={shuffling}
          onClick={() => send({ action: "shuffle", on: !shuffling })}
        >
          <ShuffleGlyph />
        </ControlButton>
        <ControlButton label="Previous track" onClick={() => send({ action: "previous" })}>
          <PreviousGlyph />
        </ControlButton>
        <Button
          size="icon"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => send({ action: "toggle" })}
          className="size-9 rounded-full"
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </Button>
        <ControlButton label="Next track" onClick={() => send({ action: "next" })}>
          <NextGlyph />
        </ControlButton>
        <ControlButton
          label={`${REPEAT_LABELS[repeat]}. Change repeat.`}
          active={repeat !== "off"}
          onClick={() => send({ action: "repeat", mode: nextRepeat })}
          className="relative"
        >
          <RepeatGlyph />
          {repeat === "one" ? (
            <span className="absolute right-1 top-1 text-[8px] font-semibold leading-none">
              1
            </span>
          ) : null}
        </ControlButton>
      </div>

      <div className="flex items-center gap-2">
        <VolumeGlyph muted={volume === 0} />
        <Slider
          label="Volume"
          value={volume}
          max={100}
          onInput={queueVolume}
          onCommit={(next) => {
            queueVolume(next);
            if (volumeTimer.current !== null) window.clearTimeout(volumeTimer.current);
            flushVolume();
          }}
        />
      </div>
    </div>
  );
}

function NowPlayingPanel() {
  const { player, error, send } = usePlayer();
  let body: ReactNode;
  if (player === null) {
    body = error === null ? <Notice>Connecting…</Notice> : null;
  } else if (player.status === "unsupported") {
    body = <Notice>Now Playing needs a bb server on macOS.</Notice>;
  } else if (player.status === "not-installed") {
    body = (
      <Notice>{APP_NAMES[player.app]} is not installed on the bb server's Mac.</Notice>
    );
  } else if (player.status === "not-running") {
    body = (
      <Notice
        action={
          <Button size="sm" onClick={() => send({ action: "play" })}>
            <PlayGlyph />
            Open {APP_NAMES[player.launchApp]}
          </Button>
        }
      >
        No music app is running.
      </Notice>
    );
  } else {
    body = <PlayerView player={player} send={send} />;
  }
  return (
    <div className="w-full p-3">
      {body}
      {error === null ? null : (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default definePluginApp((app) => {
  app.experimental_sidebarFooter.register({
    kind: "disclosure",
    id: "player",
    label: "Now Playing",
    icon: "now-playing/music",
    component: NowPlayingPanel,
  });
});
