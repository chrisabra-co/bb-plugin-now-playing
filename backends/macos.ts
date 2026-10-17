// macOS: drives Spotify and Apple Music with JavaScript for Automation.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAMES, playerSchema } from "../player-schema";
import type { Control } from "../player-schema";
import { execText } from "./common";
import type { Backend } from "./common";

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

export function osascript(
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

/** Reads Music's artwork for one track and shrinks it to a small JPEG. */
export async function musicArtwork(key: string): Promise<string | null> {
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
    await execText("/usr/bin/sips", [
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

export const macosBackend: Backend = {
  async player(action, preference, hint) {
    const [name, value] = actionArgs(action);
    const raw = JSON.parse(
      await osascript(["-l", "JavaScript", "-e", JXA, preference, hint, name, value]),
    ) as Record<string, unknown>;
    if (raw.status === "ready") {
      const app = raw.app as "spotify" | "music";
      Object.assign(raw, { appName: APP_NAMES[app], source: app });
    }
    return playerSchema.parse(raw);
  },
  async localArtwork() {
    return null;
  },
};

/** A control as the [action, value] strings the scripts take. */
export function actionArgs(action: "state" | Control): [string, string] {
  if (action === "state") return ["state", ""];
  switch (action.action) {
    case "volume":
      return ["volume", String(action.volume)];
    case "seek":
      return ["seek", String(action.positionSec)];
    case "shuffle":
      return ["shuffle", String(action.on)];
    case "repeat":
      return ["repeat", action.mode];
    default:
      return [action.action, ""];
  }
}

