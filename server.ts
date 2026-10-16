// bb-plugin-spotify — controls the Spotify desktop app on the bb server's Mac.
//
// The server drives Spotify with JavaScript for Automation (osascript). No
// Spotify account, API key, or network call is needed. The sidebar panel
// (app.tsx) and the `bb spotify` command share the RPC-free core below.
import { execFile } from "node:child_process";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

const trackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  artworkUrl: z.string(),
  durationSec: z.number().nonnegative(),
});
export type Track = z.infer<typeof trackSchema>;

const playerSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unsupported") }),
  z.object({ status: z.literal("not-installed") }),
  z.object({ status: z.literal("not-running") }),
  z.object({
    status: z.literal("ready"),
    state: z.enum(["playing", "paused", "stopped"]),
    track: trackSchema.nullable(),
    positionSec: z.number().nonnegative(),
    volume: z.number().min(0).max(100),
    shuffling: z.boolean(),
    repeating: z.boolean(),
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
  z.object({ action: z.literal("repeat"), on: z.boolean() }),
]);
export type Control = z.infer<typeof controlSchema>;

export const rpcContract = defineRpcContract({
  player_state: { input: z.null(), output: playerSchema },
  player_control: { input: controlSchema, output: playerSchema },
});

/** Realtime channel app.tsx listens on after any control action. */
const PLAYER_CHANGED = "player-changed";

// One JXA program serves every call. argv[0] is the action and argv[1] its
// value. A read never launches Spotify; a playback action does.
const JXA = String.raw`
function run(argv) {
  var action = argv[0], value = argv[1];
  var app;
  try { app = Application("com.spotify.client"); app.id(); }
  catch (e) { return JSON.stringify({ status: "not-installed" }); }
  var launches = ["play", "toggle"].indexOf(action) >= 0;
  if (!app.running()) {
    if (!launches) return JSON.stringify({ status: "not-running" });
    app.launch();
    for (var i = 0; i < 20 && !app.running(); i++) delay(0.25);
    delay(1);
  }
  switch (action) {
    case "play": app.play(); break;
    case "pause": app.pause(); break;
    case "toggle": app.playpause(); break;
    case "next": app.nextTrack(); break;
    case "previous": app.previousTrack(); break;
    case "volume": app.soundVolume = Number(value); break;
    case "seek": app.playerPosition = Number(value); break;
    case "shuffle": app.shuffling = value === "true"; break;
    case "repeat": app.repeating = value === "true"; break;
  }
  if (action !== "state") delay(0.2);
  var track = null;
  try {
    var t = app.currentTrack;
    var id = t.id();
    if (id) track = {
      id: id, name: t.name(), artist: t.artist(), album: t.album(),
      artworkUrl: t.artworkUrl() || "", durationSec: t.duration() / 1000
    };
  } catch (e) {}
  return JSON.stringify({
    status: "ready", state: String(app.playerState()), track: track,
    positionSec: Math.max(0, app.playerPosition() || 0),
    volume: app.soundVolume(), shuffling: app.shuffling(),
    repeating: app.repeating()
  });
}`;

function runJxa(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/osascript",
      ["-l", "JavaScript", "-e", JXA, ...args],
      { timeout: 15_000, maxBuffer: 64 * 1024 },
      (error, stdout, stderr) => {
        if (error === null) return resolve(stdout.trim());
        const detail = `${stderr} ${error.message}`;
        if (detail.includes("-1743") || /not authori[sz]ed/i.test(detail)) {
          return reject(
            new Error(
              "macOS blocked bb from controlling Spotify. Allow it in System Settings → Privacy & Security → Automation.",
            ),
          );
        }
        reject(new Error(stderr.trim() || error.message));
      },
    );
  });
}

async function spotify(action: "state" | Control): Promise<Player> {
  if (process.platform !== "darwin") return { status: "unsupported" };
  const args =
    action === "state"
      ? ["state"]
      : action.action === "volume"
        ? ["volume", String(action.volume)]
        : action.action === "seek"
          ? ["seek", String(action.positionSec)]
          : action.action === "shuffle" || action.action === "repeat"
            ? [action.action, String(action.on)]
            : [action.action];
  const raw: unknown = JSON.parse(await runJxa(args));
  return playerSchema.parse(raw);
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function describe(player: Player): string {
  switch (player.status) {
    case "unsupported":
      return "Spotify control needs a bb server on macOS.";
    case "not-installed":
      return "Spotify is not installed on the bb server's Mac.";
    case "not-running":
      return "Spotify is not running. Run `bb spotify play` to start it.";
    case "ready": {
      const lines = [];
      if (player.track === null) {
        lines.push(`Nothing loaded (${player.state}).`);
      } else {
        const { name, artist, album, durationSec } = player.track;
        lines.push(`${player.state === "playing" ? "▶" : "⏸"} ${name}`);
        lines.push(`  ${artist} — ${album}`);
        lines.push(
          `  ${formatTime(player.positionSec)} / ${formatTime(durationSec)}`,
        );
      }
      lines.push(
        `Volume ${player.volume}% · shuffle ${player.shuffling ? "on" : "off"} · repeat ${player.repeating ? "on" : "off"}`,
      );
      return lines.join("\n");
    }
  }
}

export default async function plugin(bb: BbPluginApi) {
  async function control(action: Control): Promise<Player> {
    const player = await spotify(action);
    bb.realtime.publish(PLAYER_CHANGED, null);
    return player;
  }

  bb.rpc.register(rpcContract, {
    player_state: () => spotify("state"),
    player_control: (input) => control(input),
  });

  const usage = [
    "Usage:",
    "  bb spotify status [--json]",
    "  bb spotify play | pause | toggle | next | previous [--json]",
    "  bb spotify volume <0-100> [--json]",
    "  bb spotify shuffle on|off [--json]",
    "  bb spotify repeat on|off [--json]",
  ].join("\n");
  bb.cli.register({
    name: "spotify",
    summary: "Control the Spotify app on the bb server's Mac",
    commands: [
      {
        name: "status",
        summary: "Show the current track and player state",
        usage: "bb spotify status [--json]",
      },
      { name: "play", summary: "Start playback", usage: "bb spotify play" },
      { name: "pause", summary: "Pause playback", usage: "bb spotify pause" },
      {
        name: "toggle",
        summary: "Play or pause",
        usage: "bb spotify toggle",
      },
      { name: "next", summary: "Skip to the next track", usage: "bb spotify next" },
      {
        name: "previous",
        summary: "Go to the previous track",
        usage: "bb spotify previous",
      },
      {
        name: "volume",
        summary: "Set the volume",
        usage: "bb spotify volume <0-100>",
      },
      {
        name: "shuffle",
        summary: "Turn shuffle on or off",
        usage: "bb spotify shuffle on|off",
      },
      {
        name: "repeat",
        summary: "Turn repeat on or off",
        usage: "bb spotify repeat on|off",
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
        case "repeat":
          if (args[0] !== "on" && args[0] !== "off") return fail(usage);
          action = { action: command, on: args[0] === "on" };
          break;
        default:
          return fail(usage);
      }
      try {
        const player =
          action === "state" ? await spotify(action) : await control(action);
        return {
          exitCode: 0,
          stdout: json ? JSON.stringify(player) : describe(player),
        };
      } catch (cause) {
        return fail(cause instanceof Error ? cause.message : String(cause));
      }
    },
  });
}
