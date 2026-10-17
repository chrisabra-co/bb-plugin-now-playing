// The player state and controls that every platform backend produces.
import { z } from "zod";

/** "other" is any player that is not Spotify or Apple Music (Linux, Windows). */
export const appSchema = z.enum(["spotify", "music", "other"]);
export type MusicApp = z.infer<typeof appSchema>;
export const repeatSchema = z.enum(["off", "all", "one"]);
export type RepeatMode = z.infer<typeof repeatSchema>;

export const APP_NAMES: Record<MusicApp, string> = {
  spotify: "Spotify",
  music: "Apple Music",
  other: "A music player",
};

export const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  durationSec: z.number().nonnegative(),
  // A web URL loads directly. The other kinds load once per track through
  // player_artwork: "music" is Apple Music on macOS (library art, or an
  // iTunes Search lookup for streamed tracks); "local" is an image the
  // server reads from the player (a file on Linux, a thumbnail on Windows).
  artwork: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("url"), url: z.string() }),
      z.object({
        kind: z.literal("music"),
        key: z.string(),
        embedded: z.boolean(),
      }),
      z.object({ kind: z.literal("local"), key: z.string() }),
    ])
    .nullable(),
});
export type Track = z.infer<typeof trackSchema>;

export const playerSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("unsupported"),
    /** Why the server cannot control music, for example a missing tool. */
    reason: z.string().optional(),
  }),
  z.object({ status: z.literal("not-installed"), app: appSchema }),
  z.object({
    status: z.literal("not-running"),
    /** The app that `play` opens, or null when the server cannot open one. */
    launchApp: appSchema.nullable(),
  }),
  z.object({
    status: z.literal("ready"),
    app: appSchema,
    /** The name to show, for example "Spotify" or "Firefox". */
    appName: z.string(),
    /** The backend's id for this player; the next call prefers it. */
    source: z.string(),
    state: z.enum(["playing", "paused", "stopped"]),
    track: trackSchema.nullable(),
    positionSec: z.number().nonnegative(),
    /** Null when the player has no volume control (Windows). */
    volume: z.number().min(0).max(100).nullable(),
    shuffling: z.boolean(),
    repeat: repeatSchema,
    repeatModes: z.array(repeatSchema),
  }),
]);
export type Player = z.infer<typeof playerSchema>;

export const controlSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["play", "pause", "toggle", "next", "previous"]),
  }),
  z.object({
    action: z.literal("volume"),
    volume: z.number().int().min(0).max(100),
  }),
  z.object({ action: z.literal("seek"), positionSec: z.number().min(0) }),
  z.object({ action: z.literal("shuffle"), on: z.boolean() }),
  z.object({ action: z.literal("repeat"), mode: repeatSchema }),
]);
export type Control = z.infer<typeof controlSchema>;

/** The `app` setting: which player to control. */
export type AppPreference = "auto" | "spotify" | "music";
