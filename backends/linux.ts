// Linux: controls any MPRIS player (Spotify, browsers, VLC, Rhythmbox, ...)
// through `playerctl`. MPRIS lives on the D-Bus session bus, so the bb server
// must run in (or reach) the desktop session that plays the music.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Control, MusicApp, Player, RepeatMode, Track } from "../player-schema";
import { artworkKey, execText, fileDataUrl, pickPlayer, sleep } from "./common";
import type { Backend } from "./common";

const SEP = "\u241f";
const FIELDS = [
  "playerName",
  "playerInstance",
  "status",
  "xesam:title",
  "xesam:artist",
  "xesam:album",
  "mpris:length",
  "position",
  "volume",
  "shuffle",
  "loop",
  "mpris:artUrl",
  "mpris:trackid",
] as const;
const FORMAT = FIELDS.map((field) => `{{${field}}}`).join(SEP);

const MISSING =
  "Now Playing needs playerctl on the bb server. Install it with your package manager, for example `sudo apt install playerctl`.";

const NAMES: Record<string, string> = {
  spotify: "Spotify",
  firefox: "Firefox",
  chromium: "Chromium",
  chrome: "Chrome",
  brave: "Brave",
  vlc: "VLC",
  rhythmbox: "Rhythmbox",
  mpv: "mpv",
  strawberry: "Strawberry",
  elisa: "Elisa",
  cider: "Cider",
};

const LOOP_TO_REPEAT: Record<string, RepeatMode> = { None: "off", Playlist: "all", Track: "one" };
const REPEAT_TO_LOOP: Record<RepeatMode, string> = { off: "None", all: "Playlist", one: "Track" };

interface Entry {
  source: string;
  app: MusicApp;
  appName: string;
  playing: boolean;
  player: Extract<Player, { status: "ready" }>;
  artFile: string | null;
}

/** playerctl needs the session bus; a systemd user service may lack it. */
function sessionEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const uid = process.getuid?.();
  if (env.DBUS_SESSION_BUS_ADDRESS === undefined && uid !== undefined) {
    const bus = `/run/user/${uid}/bus`;
    if (existsSync(bus)) env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${bus}`;
  }
  return env;
}

class MissingPlayerctl extends Error {}

async function playerctl(args: string[]): Promise<string> {
  try {
    return (await execText("playerctl", args, { env: sessionEnv(), timeout: 5_000 })).stdout;
  } catch (cause) {
    const error = cause as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    if (error.code === "ENOENT") throw new MissingPlayerctl(MISSING);
    // With --all-players, one player without metadata fails the command but
    // the others still print.
    if (error.stdout) return error.stdout;
    // No player, or (with --format) only players with no metadata.
    if (/no players? (were )?found|no player could handle/i.test(error.stderr ?? "")) return "";
    throw new Error((error.stderr ?? "").trim() || error.message);
  }
}

function displayName(name: string): string {
  const base = name.toLowerCase().replace(/\.instance.*$/, "");
  return NAMES[base] ?? base.charAt(0).toUpperCase() + base.slice(1);
}

function appOf(name: string): MusicApp {
  const base = name.toLowerCase();
  if (base.startsWith("spotify")) return "spotify";
  // Cider and other Apple Music clients name themselves after it.
  if (base.includes("applemusic") || base.startsWith("cider")) return "music";
  return "other";
}

const number = (text: string) => (text.trim() === "" ? null : Number(text));

function artwork(url: string, key: string): { art: Track["artwork"]; file: string | null } {
  if (url.startsWith("file://")) {
    try {
      return { art: { kind: "local", key }, file: fileURLToPath(url) };
    } catch {
      return { art: null, file: null };
    }
  }
  if (url.startsWith("https://")) {
    // Older Spotify clients report a page URL; the image lives on i.scdn.co.
    return {
      art: { kind: "url", url: url.replace("https://open.spotify.com/image/", "https://i.scdn.co/image/") },
      file: null,
    };
  }
  return { art: null, file: null };
}

function parse(line: string): Entry | null {
  const values = line.split(SEP);
  if (values.length !== FIELDS.length) return null;
  const field = (name: (typeof FIELDS)[number]) => values[FIELDS.indexOf(name)]!.trim();
  const source = field("playerInstance") || field("playerName");
  if (source === "") return null;
  const status = field("status").toLowerCase();
  const state = status === "playing" ? "playing" : status === "paused" ? "paused" : "stopped";
  const title = field("xesam:title");
  const artist = field("xesam:artist");
  const key = artworkKey(source, field("mpris:trackid"), title);
  const { art, file } = artwork(field("mpris:artUrl"), key);
  const loop = field("loop");
  const volume = number(field("volume"));
  const lengthUs = number(field("mpris:length")) ?? 0;
  const appName = displayName(field("playerName") || source);
  const app = appOf(field("playerName") || source);
  const track: Track | null =
    title === ""
      ? null
      : {
          id: field("mpris:trackid") || `${artist}\u0000${title}`,
          name: title,
          artist,
          album: field("xesam:album"),
          durationSec: Math.max(0, lengthUs / 1e6),
          artwork: art,
        };
  return {
    source,
    app,
    appName,
    playing: state === "playing",
    artFile: file,
    player: {
      status: "ready",
      app,
      appName,
      source,
      state,
      track,
      positionSec: Math.max(0, (number(field("position")) ?? 0) / 1e6),
      volume: volume === null || Number.isNaN(volume) ? null : Math.round(Math.min(1, volume) * 100),
      shuffling: field("shuffle").toLowerCase() === "true",
      repeat: LOOP_TO_REPEAT[loop] ?? "off",
      repeatModes: loop === "" ? ["off"] : ["off", "all", "one"],
    },
  };
}

/** A player with nothing loaded, which `metadata --format` skips. */
async function idleEntry(source: string): Promise<Entry | null> {
  const status = (await playerctl(["--player", source, "status"]).catch(() => "")).trim();
  if (status === "") return null;
  const name = source.split(".")[0]!;
  return parse([name, source, status, "", "", "", "", "0", "", "false", "", "", ""].join(SEP));
}

async function players(): Promise<Entry[]> {
  const [out, names] = await Promise.all([
    playerctl(["--all-players", "metadata", "--format", FORMAT]),
    playerctl(["--list-all"]),
  ]);
  const entries = out
    .split("\n")
    .map(parse)
    .filter((entry): entry is Entry => entry !== null);
  const known = new Set(entries.map((entry) => entry.source));
  const idle = names
    .split("\n")
    .map((name) => name.trim())
    .filter((name) => name !== "" && !known.has(name));
  for (const entry of await Promise.all(idle.map(idleEntry))) {
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

function controlArgs(action: Control): string[] {
  switch (action.action) {
    case "play":
      return ["play"];
    case "pause":
      return ["pause"];
    case "toggle":
      return ["play-pause"];
    case "next":
      return ["next"];
    case "previous":
      return ["previous"];
    case "volume":
      return ["volume", String(action.volume / 100)];
    case "seek":
      return ["position", String(action.positionSec)];
    case "shuffle":
      return ["shuffle", action.on ? "On" : "Off"];
    case "repeat":
      return ["loop", REPEAT_TO_LOOP[action.mode]];
  }
}

async function hasSpotify(): Promise<boolean> {
  try {
    await execText("sh", ["-c", "command -v spotify"], { timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}

export function createLinuxBackend(): Backend {
  // Art files by key, so player_artwork reads only paths a player reported.
  const artFiles = new Map<string, string>();
  // playerctl prints "None" for a player with no LoopStatus, so ask once
  // for each player: `loop` alone fails when the player has none.
  const loops = new Map<string, boolean>();
  async function hasLoop(source: string): Promise<boolean> {
    let known = loops.get(source);
    if (known === undefined) {
      known = await playerctl(["--player", source, "loop"]).then(
        (out) => out.trim() !== "",
        () => false,
      );
      loops.set(source, known);
      if (loops.size > 20) loops.delete(loops.keys().next().value!);
    }
    return known;
  }

  return {
    async player(action, preference, hint) {
      let list: Entry[];
      try {
        list = await players();
      } catch (cause) {
        if (cause instanceof MissingPlayerctl) return { status: "unsupported", reason: cause.message };
        throw cause;
      }
      let pick = pickPlayer(list, preference, hint);
      const wantsPlay = action !== "state" && (action.action === "play" || action.action === "toggle");
      if (pick === null) {
        if (preference === "music") return { status: "not-installed", app: "music" };
        const spotify = await hasSpotify();
        if (!wantsPlay || !spotify) {
          if (preference === "spotify" && !spotify) return { status: "not-installed", app: "spotify" };
          return { status: "not-running", launchApp: spotify ? "spotify" : null };
        }
        spawn("spotify", [], { detached: true, stdio: "ignore", env: sessionEnv() })
          .on("error", () => {})
          .unref();
        for (let i = 0; i < 20 && pick === null; i++) {
          await sleep(500);
          pick = pickPlayer(await players(), "spotify", hint);
        }
        if (pick === null) return { status: "not-running", launchApp: "spotify" };
      }
      if (action !== "state") {
        await playerctl(["--player", pick.source, ...controlArgs(action)]);
        await sleep(200);
        pick = (await players()).find((entry) => entry.source === pick!.source) ?? pick;
      }
      if (!(await hasLoop(pick.source))) {
        pick = { ...pick, player: { ...pick.player, repeat: "off", repeatModes: ["off"] } };
      }
      if (pick.artFile !== null && pick.player.track?.artwork?.kind === "local") {
        artFiles.set(pick.player.track.artwork.key, pick.artFile);
        if (artFiles.size > 20) artFiles.delete(artFiles.keys().next().value!);
      }
      return pick.player;
    },

    async localArtwork(key) {
      const file = artFiles.get(key);
      return file === undefined ? null : fileDataUrl(file);
    },
  };
}
