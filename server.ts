// bb-plugin-now-playing — controls Spotify or Apple Music on the bb server's
// Mac.
//
// The server drives each app with JavaScript for Automation (osascript). No
// account, API key, or network call is needed. The sidebar panel (app.tsx)
// and the `bb music` command share the core below.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { ACCENT_STYLES, STYLES } from "./shared";

const appSchema = z.enum(["spotify", "music"]);
export type MusicApp = z.infer<typeof appSchema>;
const repeatSchema = z.enum(["off", "all", "one"]);
export type RepeatMode = z.infer<typeof repeatSchema>;

const APP_NAMES: Record<MusicApp, string> = {
  spotify: "Spotify",
  music: "Apple Music",
};

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  durationSec: z.number().nonnegative(),
  // Spotify gives a web URL. Music tracks load their art once per track
  // through player_artwork: library tracks hold image bytes, and streamed
  // tracks hold none, so the server looks those up.
  artwork: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("url"), url: z.string() }),
      z.object({
        kind: z.literal("music"),
        key: z.string(),
        embedded: z.boolean(),
      }),
    ])
    .nullable(),
});
export type Track = z.infer<typeof trackSchema>;

const playerSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unsupported") }),
  z.object({ status: z.literal("not-installed"), app: appSchema }),
  z.object({ status: z.literal("not-running"), launchApp: appSchema }),
  z.object({
    status: z.literal("ready"),
    app: appSchema,
    state: z.enum(["playing", "paused", "stopped"]),
    track: trackSchema.nullable(),
    positionSec: z.number().nonnegative(),
    volume: z.number().min(0).max(100),
    shuffling: z.boolean(),
    repeat: repeatSchema,
    repeatModes: z.array(repeatSchema),
  }),
]);
export type Player = z.infer<typeof playerSchema>;

const controlSchema = z.discriminatedUnion("action", [
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

// One JXA program serves every call: argv is [preference, hint, action,
// value]. "auto" picks the app that plays, then the running app, with the
// hint (the app last used) first. A read never launches an app; play and
// toggle launch one when none runs.
const JXA = String.raw`
function run(argv) {
  var pref = argv[0], hint = argv[1], action = argv[2], value = argv[3];
  var ids = { spotify: "com.spotify.client", music: "com.apple.Music" };
  var apps = {};
  for (var key in ids) {
    try { apps[key] = Application(ids[key]); apps[key].id(); }
    catch (e) { apps[key] = null; }
  }
  var names = pref !== "auto" ? [pref]
    : hint === "music" ? ["music", "spotify"] : ["spotify", "music"];
  function running(name) { return apps[name] !== null && apps[name].running(); }
  function playing(name) {
    try { return running(name) && String(apps[name].playerState()) === "playing"; }
    catch (e) { return false; }
  }
  var pick = null, i;
  for (i = 0; i < names.length && pick === null; i++) if (playing(names[i])) pick = names[i];
  for (i = 0; i < names.length && pick === null; i++) if (running(names[i])) pick = names[i];
  if (pick === null) {
    var installed = names.filter(function (n) { return apps[n] !== null; });
    if (installed.length === 0) return JSON.stringify({ status: "not-installed", app: names[0] });
    if (action !== "play" && action !== "toggle") {
      return JSON.stringify({ status: "not-running", launchApp: installed[0] });
    }
    pick = installed[0];
    apps[pick].launch();
    for (i = 0; i < 20 && !apps[pick].running(); i++) delay(0.25);
    delay(1);
  }
  var app = apps[pick], spotify = pick === "spotify";
  switch (action) {
    case "play": app.play(); break;
    case "pause": app.pause(); break;
    case "toggle": app.playpause(); break;
    case "next": app.nextTrack(); break;
    case "previous": app.previousTrack(); break;
    case "volume": app.soundVolume = Number(value); break;
    case "seek": app.playerPosition = Number(value); break;
    case "shuffle":
      if (spotify) app.shuffling = value === "true"; else app.shuffleEnabled = value === "true";
      break;
    case "repeat":
      if (spotify) app.repeating = value !== "off"; else app.songRepeat = value;
      break;
  }
  if (action !== "state") delay(0.2);
  var state = String(app.playerState());
  if (state === "fast forwarding" || state === "rewinding") state = "playing";
  var track = null;
  try {
    var t = app.currentTrack;
    if (spotify) {
      var id = t.id();
      if (id) track = {
        id: id, name: t.name(), artist: t.artist(), album: t.album(),
        durationSec: t.duration() / 1000,
        artwork: t.artworkUrl() ? { kind: "url", url: t.artworkUrl() } : null
      };
    } else {
      var pid = t.persistentID();
      var embedded = false;
      try { embedded = t.artworks.length > 0; } catch (e) {}
      track = {
        id: pid, name: t.name(), artist: t.artist(), album: t.album(),
        durationSec: t.duration() || 0,
        artwork: { kind: "music", key: pid, embedded: embedded }
      };
    }
  } catch (e) {}
  return JSON.stringify({
    status: "ready", app: pick, state: state, track: track,
    positionSec: Math.max(0, app.playerPosition() || 0),
    volume: app.soundVolume(),
    shuffling: spotify ? app.shuffling() : app.shuffleEnabled(),
    repeat: spotify ? (app.repeating() ? "all" : "off") : String(app.songRepeat()),
    repeatModes: spotify ? ["off", "all"] : ["off", "all", "one"]
  });
}`;

// AppleScript prints raw data as «data JPEG…hex…», which JXA cannot return.
const MUSIC_ARTWORK = [
  "on run argv",
  'if application id "com.apple.Music" is not running then return ""',
  'tell application id "com.apple.Music"',
  "if persistent ID of current track is not (item 1 of argv) then return \"\"",
  'if (count of artworks of current track) is 0 then return ""',
  "return raw data of artwork 1 of current track",
  "end tell",
  "end run",
];

function osascript(
  args: string[],
  maxBuffer = 64 * 1024,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/osascript",
      args,
      { timeout: 15_000, maxBuffer },
      (error, stdout, stderr) => {
        if (error === null) return resolve(stdout.trim());
        const detail = `${stderr} ${error.message}`;
        if (detail.includes("-1743") || /not authori[sz]ed/i.test(detail)) {
          return reject(
            new Error(
              "macOS blocked bb from controlling the music app. Allow it in System Settings → Privacy & Security → Automation.",
            ),
          );
        }
        reject(new Error(stderr.trim() || error.message));
      },
    );
  });
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 15_000 }, (error) =>
      error === null ? resolve() : reject(error),
    );
  });
}

/** Reads Music's artwork for one track and shrinks it to a small JPEG. */
async function musicArtwork(key: string): Promise<string | null> {
  const raw = await osascript(
    ["-e", MUSIC_ARTWORK.join("\n"), key],
    64 * 1024 * 1024,
  );
  const match = /^«data (.{4})([0-9A-Fa-f]+)»$/.exec(raw);
  if (match === null) return null;
  const dir = await mkdtemp(join(tmpdir(), "bb-now-playing-"));
  try {
    const source = join(dir, "artwork");
    const target = join(dir, "artwork.jpg");
    await writeFile(source, Buffer.from(match[2]!, "hex"));
    await run("/usr/bin/sips", [
      "-s", "format", "jpeg",
      "-s", "formatOptions", "80",
      "-Z", "200",
      source, "--out", target,
    ]);
    const jpeg = await readFile(target);
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

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
      return "Now Playing needs a bb server on macOS.";
    case "not-installed":
      return `${APP_NAMES[player.app]} is not installed on the bb server's Mac.`;
    case "not-running":
      return `No music app is running. Run \`bb music play\` to start ${APP_NAMES[player.launchApp]}.`;
    case "ready": {
      const lines = [];
      if (player.track === null) {
        lines.push(`${APP_NAMES[player.app]}: nothing loaded (${player.state}).`);
      } else {
        const { name, artist, album, durationSec } = player.track;
        lines.push(`${player.state === "playing" ? "▶" : "⏸"} ${name}`);
        lines.push(`  ${artist} — ${album}`);
        lines.push(
          `  ${formatTime(player.positionSec)} / ${formatTime(durationSec)} · ${APP_NAMES[player.app]}`,
        );
      }
      lines.push(
        `Volume ${player.volume}% · shuffle ${player.shuffling ? "on" : "off"} · repeat ${player.repeat}`,
      );
      return lines.join("\n");
    }
  }
}

export default async function plugin(bb: BbPluginApi) {
  const settings = bb.settings.define({
    app: {
      type: "select",
      label: "Music app",
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

  // The app last seen playing or controlled. "auto" checks it first.
  let lastApp: MusicApp = "spotify";
  const artworkCache = new Map<string, string | null>();
  // Recent Music tracks by persistent ID, so player_artwork accepts only a
  // key the player reported and knows what to look up.
  const musicTracks = new Map<string, Track>();
  const remember = <V>(map: Map<string, V>, key: string, value: V) => {
    map.delete(key);
    if (map.size >= 20) map.delete(map.keys().next().value!);
    map.set(key, value);
  };

  async function player(action: "state" | Control): Promise<Player> {
    if (process.platform !== "darwin") return { status: "unsupported" };
    const { app: preference } = await settings.get();
    const [name, value] =
      action === "state"
        ? ["state", ""]
        : action.action === "volume"
          ? ["volume", String(action.volume)]
          : action.action === "seek"
            ? ["seek", String(action.positionSec)]
            : action.action === "shuffle"
              ? ["shuffle", String(action.on)]
              : action.action === "repeat"
                ? ["repeat", action.mode]
                : [action.action, ""];
    const raw: unknown = JSON.parse(
      await osascript([
        "-l", "JavaScript", "-e", JXA,
        String(preference), lastApp, name, value,
      ]),
    );
    const result = playerSchema.parse(raw);
    if (result.status === "ready" && result.track?.artwork?.kind === "music") {
      remember(musicTracks, result.track.artwork.key, result.track);
    }
    if (
      result.status === "ready" &&
      (action !== "state" || result.state === "playing")
    ) {
      lastApp = result.app;
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
      await bb.storage.kv.get(APPEARANCE_KEY),
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
      const track = musicTracks.get(key);
      if (track === undefined || track.artwork?.kind !== "music") {
        return { url: null };
      }
      if (!artworkCache.has(key)) {
        let url = track.artwork.embedded ? await musicArtwork(key) : null;
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
    summary: "Control Spotify or Apple Music on the bb server's Mac",
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
        summary: "Set the volume",
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
        summary: "Show or set which app to control",
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
