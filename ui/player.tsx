// Player state, controls, and artwork that every style shares.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRealtime, useRealtimeConnectionState, useRpc } from "@get-bb/plugin-sdk/app";
import type { Appearance, Control, MusicApp, Player, Track, rpcContract } from "../server";
import { cn } from "@/lib/utils";

const POLL_MS = 1000;

export const APP_NAMES: Record<MusicApp, string> = {
  spotify: "Spotify",
  music: "Apple Music",
};

export type ReadyPlayer = Extract<Player, { status: "ready" }>;

/**
 * Polls the player while the panel is open and the page is visible.
 * `intervalMs` is longer on the settings page, where the panel may also poll.
 */
export function usePlayer(intervalMs = POLL_MS) {
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
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh, intervalMs]);
  useRealtime("player-changed", refresh);

  const send = useCallback(
    (control: Control) => {
      rpc.call("player_control", control).then(apply, report);
    },
    [rpc, apply, report],
  );

  return { player, error, send };
}

export const DEFAULT_APPEARANCE: Appearance = { style: "default", accents: {} };

/**
 * The style and accents, shared by every bb window. `holdReload` lets the
 * settings page skip a reload while its own save is still pending, so a
 * color being dragged does not jump back.
 */
export function useAppearance(holdReload?: () => boolean) {
  const rpc = useRpc<typeof rpcContract>();
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const hold = useRef(holdReload);
  hold.current = holdReload;
  const load = useCallback(() => {
    if (hold.current?.() === true) return;
    rpc.call("appearance_get").then(setAppearance, () => {
      // Show the default look rather than an empty panel; the next signal
      // or reconnect loads the stored style.
      setAppearance((current) => current ?? DEFAULT_APPEARANCE);
    });
  }, [rpc]);
  useEffect(load, [load]);
  useRealtime("appearance-changed", load);
  // Realtime signals are lost while the connection is down; reload after it.
  const connection = useRealtimeConnectionState();
  const wasConnected = useRef(connection === "connected");
  useEffect(() => {
    if (connection === "connected" && !wasConnected.current) load();
    wasConnected.current = connection === "connected";
  }, [connection, load]);
  return { appearance, setAppearance };
}

export interface PlayerActions {
  play(): void;
  pause(): void;
  toggle(): void;
  next(): void;
  previous(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  seek(positionSec: number): void;
  /** Sends volume while the user drags, at most every 150 ms. */
  volumeInput(volume: number): void;
  /** Sends the final volume at once. */
  volumeCommit(volume: number): void;
}

export function usePlayerActions(
  player: ReadyPlayer,
  send: (control: Control) => void,
): PlayerActions {
  const { shuffling, repeat, repeatModes } = player;
  const timer = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  return useMemo(() => {
    const flush = () => {
      timer.current = null;
      if (pending.current === null) return;
      send({ action: "volume", volume: pending.current });
      pending.current = null;
    };
    const queue = (volume: number) => {
      pending.current = Math.round(Math.max(0, Math.min(100, volume)));
      if (timer.current === null) timer.current = window.setTimeout(flush, 150);
    };
    const nextRepeat =
      repeatModes[(repeatModes.indexOf(repeat) + 1) % repeatModes.length] ?? "off";
    return {
      play: () => send({ action: "play" }),
      pause: () => send({ action: "pause" }),
      toggle: () => send({ action: "toggle" }),
      next: () => send({ action: "next" }),
      previous: () => send({ action: "previous" }),
      toggleShuffle: () => send({ action: "shuffle", on: !shuffling }),
      cycleRepeat: () => send({ action: "repeat", mode: nextRepeat }),
      seek: (positionSec) => send({ action: "seek", positionSec: Math.max(0, positionSec) }),
      volumeInput: queue,
      volumeCommit: (volume) => {
        queue(volume);
        if (timer.current !== null) window.clearTimeout(timer.current);
        flush();
      },
    };
  }, [send, shuffling, repeat, repeatModes]);
}

export function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export const REPEAT_LABELS = {
  off: "Repeat is off",
  all: "Repeating all",
  one: "Repeating one track",
} as const;

/** Spotify artwork is a URL. Music artwork loads once per track over RPC. */
export function useArtworkUrl(artwork: Track["artwork"]): string | null {
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
  if (artwork.kind === "url") return artwork.url === "" ? null : artwork.url;
  return loaded?.key === artwork.key ? loaded.url : null;
}

/**
 * A native range input laid over any visual, so pointer, touch, and keyboard
 * input work in every style. `children` draws the value being dragged.
 */
export function Scrub({
  label,
  value,
  max,
  step = 1,
  onInput,
  onCommit,
  className,
  children,
}: {
  label: string;
  value: number;
  max: number;
  step?: number;
  onInput?: (value: number) => void;
  onCommit: (value: number) => void;
  className?: string;
  children: (shown: number, percent: number) => ReactNode;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const percent = max > 0 ? Math.min(100, Math.max(0, (shown / max) * 100)) : 0;
  const commit = () => {
    if (draft === null) return;
    onCommit(draft);
    setDraft(null);
  };
  return (
    <div
      className={cn(
        "relative rounded-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--ring)]",
        className,
      )}
    >
      {children(shown, percent)}
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
        className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
