// bb-plugin-now-playing — controls the music player on the bb server.
//
// Each platform has a backend (backends/): JavaScript for Automation on
// macOS, MPRIS through playerctl on Linux, and the Windows media controls on
// Windows. No account, API key, or network call is needed. The sidebar panel
// (app.tsx) and the `bb music` command share the core below.
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import type { Backend } from "./backends/common";
import { createLinuxBackend } from "./backends/linux";
import { macosBackend, musicArtwork } from "./backends/macos";
import { createWindowsBackend } from "./backends/windows";
import {
  APP_NAMES,
  controlSchema,
  playerSchema,
  repeatSchema,
  type AppPreference,
  type Control,
  type Player,
  type Track,
} from "./player-schema";
import { ACCENT_STYLES, STYLES } from "./shared";

export type { Control, MusicApp, Player, RepeatMode, Track } from "./player-schema";

const styleSchema = z.enum(STYLES);
const accentStyleSchema = z.enum(ACCENT_STYLES);
const hexSchema = z.string().regex(/^#[0-9a-f]{6}$/);

// The style is the same in every bb window. A style with no stored accent
// uses its default (see ui/theme.ts).
const appearanceSchema = z.object({
  style: styleSchema,
  accents: z.partialRecord(accentStyleSchema, hexSchema),
});
export type Appearance = z.infer<typeof appearanceSchema>;
const DEFAULT_APPEARANCE: Appearance = { style: "default", accents: {} };

const appearancePatchSchema = z.union([
  z.object({ style: styleSchema }),
  // A null color goes back to the style's default.
  z.object({ accent: accentStyleSchema, color: hexSchema.nullable() }),
]);
export type AppearancePatch = z.infer<typeof appearancePatchSchema>;

/** v0.3.0 called the bb-amp style "winamp"; read those values as "bbamp". */
function renameWinamp(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const { style, accents } = value as { style?: unknown; accents?: unknown };
  const next: Record<string, unknown> = { ...value, style: style === "winamp" ? "bbamp" : style };
  if (typeof accents === "object" && accents !== null && "winamp" in accents) {
    const { winamp, ...rest } = accents as Record<string, unknown>;
    next.accents = { bbamp: winamp, ...rest };
  }
  return next;
}

export const rpcContract = defineRpcContract({
  player_state: { input: z.null(), output: playerSchema },
  player_control: { input: controlSchema, output: playerSchema },
  player_artwork: {
    input: z.object({ key: z.string().regex(/^[0-9A-Fa-f]{1,32}$/) }),
    output: z.object({ url: z.string().nullable() }),
  },
  appearance_get: { input: z.null(), output: appearanceSchema },
  appearance_set: { input: appearancePatchSchema, output: appearanceSchema },
});

/** Realtime channel app.tsx listens on after any control action. */
const PLAYER_CHANGED = "player-changed";
/** Realtime channel for a new style or accent. */
const APPEARANCE_CHANGED = "appearance-changed";
const APPEARANCE_KEY = "appearance";

const itunesSchema = z.object({
  results: z.array(
    z.object({
      artistName: z.string().optional(),
      trackName: z.string().optional(),
      collectionName: z.string().optional(),
      artworkUrl100: z.string().optional(),
    }),
  ),
});

/**
 * Finds a streamed track's cover with Apple's public iTunes Search API. It
 * sends only the artist and title, and accepts only a result by the same
 * artist, so a wrong guess shows the music note instead of another cover.
 */
async function lookupArtwork(track: Track): Promise<string | null> {
  const normalize = (text = "") => text.trim().toLowerCase();
  // Encode spaces as %20: the API returns no results for "+" in some terms.
  const term = encodeURIComponent(`${track.artist} ${track.name}`);
  const response = await fetch(
    `https://itunes.apple.com/search?media=music&entity=song&limit=10&term=${term}`,
    { signal: AbortSignal.timeout(8_000) },
  );
  if (!response.ok) return null;
  const { results } = itunesSchema.parse(await response.json());
  const byArtist = results.filter(
    (result) =>
      normalize(result.artistName) === normalize(track.artist) &&
      result.artworkUrl100 !== undefined,
  );
  const best =
    byArtist.find(
      (result) =>
        normalize(result.trackName) === normalize(track.name) &&
        normalize(result.collectionName) === normalize(track.album),
    ) ??
    byArtist.find(
      (result) => normalize(result.trackName) === normalize(track.name),
    ) ??
    byArtist.find(
      (result) => normalize(result.collectionName) === normalize(track.album),
    );
  if (best?.artworkUrl100 === undefined) return null;
  const url = new URL(best.artworkUrl100);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".mzstatic.com")) {
    return null;
  }
  return url.href.replace(/\/100x100bb\./, "/300x300bb.");
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function describe(player: Player): string {
  switch (player.status) {
    case "unsupported":
      return player.reason ?? "Now Playing needs a bb server on macOS, Linux, or Windows.";
    case "not-installed":
      return `${APP_NAMES[player.app]} is not installed on the bb server.`;
    case "not-running":
      return player.launchApp === null
        ? "No music player is running on the bb server."
        : `No music app is running. Run \`bb music play\` to start ${APP_NAMES[player.launchApp]}.`;
    case "ready": {
      const lines = [];
      if (player.track === null) {
        lines.push(`${player.appName}: nothing loaded (${player.state}).`);
      } else {
        const { name, artist, album, durationSec } = player.track;
        lines.push(`${player.state === "playing" ? "▶" : "⏸"} ${name}`);
        lines.push(album === "" ? `  ${artist}` : `  ${artist} — ${album}`);
        lines.push(
          `  ${formatTime(player.positionSec)} / ${formatTime(durationSec)} · ${player.appName}`,
        );
      }
      const volume = player.volume === null ? [] : [`Volume ${player.volume}%`];
      lines.push(
        [...volume, `shuffle ${player.shuffling ? "on" : "off"}`, `repeat ${player.repeat}`].join(" · "),
      );
      return lines.join("\n");
    }
  }
}

function createBackend(): Backend | null {
  switch (process.platform) {
    case "darwin":
      return macosBackend;
    case "linux":
      return createLinuxBackend();
    case "win32":
      return createWindowsBackend();
    default:
      return null;
  }
}

export default async function plugin(bb: BbPluginApi) {
  const settings = bb.settings.define({
    app: {
      type: "select",
      label: "Music player",
      options: ["auto", "spotify", "music"],
      experimental_optionLabels: {
        auto: "Whichever is playing",
        spotify: "Spotify",
        music: "Apple Music",
      },
      default: "auto",
    },
    artworkLookup: {
      type: "boolean",
      label: "Find album art for streamed Apple Music tracks (sends the artist and title to Apple's iTunes Search)",
      default: true,
    },
  });

  const backend = createBackend();
  // The player last seen playing or controlled. "auto" checks it first.
  let lastSource = "spotify";
  const artworkCache = new Map<string, string | null>();
  // Recent tracks by artwork key, so player_artwork accepts only a key the
  // player reported and knows what to load.
  const artworkTracks = new Map<string, Track>();
  const remember = <V>(map: Map<string, V>, key: string, value: V) => {
    map.delete(key);
    if (map.size >= 20) map.delete(map.keys().next().value!);
    map.set(key, value);
  };

  async function player(action: "state" | Control): Promise<Player> {
    if (backend === null) return { status: "unsupported" };
    const { app: preference } = await settings.get();
    const result = playerSchema.parse(
      await backend.player(action, preference as AppPreference, lastSource),
    );
    const artwork = result.status === "ready" ? result.track?.artwork : null;
    if (result.status === "ready" && artwork != null && artwork.kind !== "url") {
      remember(artworkTracks, artwork.key, result.track!);
    }
    if (
      result.status === "ready" &&
      (action !== "state" || result.state === "playing")
    ) {
      lastSource = result.source;
    }
    return result;
  }

  async function control(action: Control): Promise<Player> {
    const result = await player(action);
    bb.realtime.publish(PLAYER_CHANGED, null);
    return result;
  }

  async function getAppearance(): Promise<Appearance> {
    const stored = appearanceSchema.safeParse(
      renameWinamp(await bb.storage.kv.get(APPEARANCE_KEY)),
    );
    return stored.success ? stored.data : DEFAULT_APPEARANCE;
  }

  // Writes run one at a time, so two windows (or a window and the CLI)
  // cannot overwrite each other's change.
  let appearanceWrites: Promise<unknown> = Promise.resolve();
  function setAppearance(patch: AppearancePatch): Promise<Appearance> {
    const write = appearanceWrites.then(() => writeAppearance(patch));
    appearanceWrites = write.catch(() => {});
    return write;
  }

  async function writeAppearance(patch: AppearancePatch): Promise<Appearance> {
    const current = await getAppearance();
    let next: Appearance;
    if ("style" in patch) {
      next = { ...current, style: patch.style };
    } else {
      const accents = { ...current.accents };
      if (patch.color === null) delete accents[patch.accent];
      else accents[patch.accent] = patch.color;
      next = { ...current, accents };
    }
    await bb.storage.kv.set(APPEARANCE_KEY, next);
    bb.realtime.publish(APPEARANCE_CHANGED, null);
    return next;
  }

  bb.rpc.register(rpcContract, {
    player_state: () => player("state"),
    player_control: (input) => control(input),
    player_artwork: async ({ key }) => {
      const track = artworkTracks.get(key);
      const artwork = track?.artwork;
      if (track === undefined || backend === null || artwork == null || artwork.kind === "url") {
        return { url: null };
      }
      if (artwork.kind === "local") {
        // Do not cache a miss: some players add the image a moment later.
        if (!artworkCache.has(key)) {
          const url = await backend.localArtwork(key, track);
          if (url === null) return { url: null };
          remember(artworkCache, key, url);
        }
        return { url: artworkCache.get(key) ?? null };
      }
      if (!artworkCache.has(key)) {
        let url = artwork.embedded ? await musicArtwork(key) : null;
        if (url === null && (await settings.get()).artworkLookup) {
          try {
            url = await lookupArtwork(track);
          } catch (cause) {
            // Do not cache a network failure; the next track change retries.
            bb.log.warn(`Artwork lookup failed: ${String(cause)}`);
            return { url: null };
          }
        }
        remember(artworkCache, key, url);
      }
      return { url: artworkCache.get(key) ?? null };
    },
    appearance_get: () => getAppearance(),
    appearance_set: (patch) => setAppearance(patch),
  });

  const usage = [
    "Usage:",
    "  bb music status [--json]",
    "  bb music play | pause | toggle | next | previous [--json]",
    "  bb music volume <0-100> [--json]",
    "  bb music shuffle on|off [--json]",
    "  bb music repeat off|all|one [--json]",
    "  bb music app [auto|spotify|music]",
    `  bb music style [${STYLES.join("|")}]`,
  ].join("\n");
  bb.cli.register({
    name: "music",
    summary: "Control the music player on the bb server",
    commands: [
      {
        name: "status",
        summary: "Show the current track and player state",
        usage: "bb music status [--json]",
      },
      { name: "play", summary: "Start playback", usage: "bb music play" },
      { name: "pause", summary: "Pause playback", usage: "bb music pause" },
      { name: "toggle", summary: "Play or pause", usage: "bb music toggle" },
      { name: "next", summary: "Skip to the next track", usage: "bb music next" },
      {
        name: "previous",
        summary: "Go to the previous track",
        usage: "bb music previous",
      },
      {
        name: "volume",
        summary: "Set the volume (macOS and Linux)",
        usage: "bb music volume <0-100>",
      },
      {
        name: "shuffle",
        summary: "Turn shuffle on or off",
        usage: "bb music shuffle on|off",
      },
      {
        name: "repeat",
        summary: "Set repeat (Spotify has no 'one' mode)",
        usage: "bb music repeat off|all|one",
      },
      {
        name: "app",
        summary: "Show or set which player to control (auto is any player)",
        usage: "bb music app [auto|spotify|music]",
      },
      {
        name: "style",
        summary: "Show or set the look of the sidebar player",
        usage: `bb music style [${STYLES.join("|")}]`,
      },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const [command, ...args] = argv.filter((arg) => arg !== "--json");
      const fail = (message: string) => ({ exitCode: 1, stderr: message });
      let action: "state" | Control;
      switch (command) {
        case undefined:
        case "help":
        case "--help":
          return { exitCode: 0, stdout: usage };
        case "app": {
          const next = args[0];
          if (next === undefined) {
            const { app: current } = await settings.get();
            return { exitCode: 0, stdout: String(current) };
          }
          if (next !== "auto" && next !== "spotify" && next !== "music") {
            return fail("App must be auto, spotify, or music.");
          }
          await settings.experimental_set({ app: next });
          return { exitCode: 0, stdout: `Controlling: ${next}` };
        }
        case "style": {
          if (args[0] === undefined) {
            return { exitCode: 0, stdout: (await getAppearance()).style };
          }
          const style = styleSchema.safeParse(args[0]);
          if (!style.success) {
            return fail(`Style must be one of: ${STYLES.join(", ")}.`);
          }
          await setAppearance({ style: style.data });
          return { exitCode: 0, stdout: `Style: ${style.data}` };
        }
        case "status":
          action = "state";
          break;
        case "play":
        case "pause":
        case "toggle":
        case "next":
        case "previous":
          action = { action: command };
          break;
        case "volume": {
          const volume = Number(args[0]);
          if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
            return fail("Volume must be a whole number from 0 to 100.");
          }
          action = { action: "volume", volume };
          break;
        }
        case "shuffle":
          if (args[0] !== "on" && args[0] !== "off") return fail(usage);
          action = { action: "shuffle", on: args[0] === "on" };
          break;
        case "repeat": {
          const mode = repeatSchema.safeParse(args[0]);
          if (!mode.success) return fail(usage);
          action = { action: "repeat", mode: mode.data };
          break;
        }
        default:
          return fail(usage);
      }
      try {
        const result =
          action === "state" ? await player(action) : await control(action);
        return {
          exitCode: 0,
          stdout: json ? JSON.stringify(result) : describe(result),
        };
      } catch (cause) {
        return fail(cause instanceof Error ? cause.message : String(cause));
      }
    },
  });
}
