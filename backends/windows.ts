// Windows: controls any app that shows in the Windows media overlay (Spotify,
// Apple Music, browsers, Media Player, ...) through the System Media
// Transport Controls. One PowerShell process runs the WinRT calls and stays
// open while the panel polls; it exits after a short idle time.
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { Control, MusicApp, Player, RepeatMode, Track } from "../player-schema";
import { artworkKey, imageDataUrl, pickPlayer, sleep } from "./common";
import type { Backend } from "./common";

// Reads one JSON request per line on stdin and writes one JSON reply per line.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false } catch {}
$manager = $null
$initError = $null
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation${"`"}1'
  } | Select-Object -First 1
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
} catch { $initError = $_.Exception.Message }

function Await($op, [Type]$type, [int]$ms = 3000) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  if (-not $task.Wait($ms)) { throw 'Windows did not answer in time.' }
  $task.Result
}

function Props($s, [int]$ms = 3000) {
  Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]) $ms
}

function Sessions {
  $seen = @{}
  foreach ($s in $manager.GetSessions()) {
    $id = [string]$s.SourceAppUserModelId
    if ($seen.ContainsKey($id)) { $seen[$id] += 1; $id = "$id#$($seen[$id])" } else { $seen[$id] = 1 }
    [pscustomobject]@{ Source = $id; Session = $s }
  }
}

function Find($source) {
  $entry = Sessions | Where-Object { $_.Source -eq $source } | Select-Object -First 1
  if (-not $entry) { throw 'That player closed.' }
  $entry.Session
}

function Describe($entry) {
  $s = $entry.Session
  $info = $s.GetPlaybackInfo()
  $tl = $s.GetTimelineProperties()
  $props = $null
  # A player that does not answer must not hold up the others.
  try { $props = Props $s 1000 } catch {}
  $status = [string]$info.PlaybackStatus
  $position = $tl.Position.TotalSeconds
  if ($status -eq 'Playing' -and $tl.LastUpdatedTime.Year -gt 2000) {
    $position += ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalSeconds
  }
  $duration = ($tl.EndTime - $tl.StartTime).TotalSeconds
  if ($duration -gt 0 -and $position -gt $duration) { $position = $duration }
  $title = ''; $artist = ''; $album = ''; $thumb = $false
  if ($props) {
    $title = [string]$props.Title
    $artist = [string]$props.Artist
    if (-not $artist) { $artist = [string]$props.AlbumArtist }
    $album = [string]$props.AlbumTitle
    $thumb = $null -ne $props.Thumbnail
  }
  $repeat = $null
  if ($null -ne $info.AutoRepeatMode) { $repeat = [string]$info.AutoRepeatMode }
  @{
    source = $entry.Source; status = $status
    title = $title; artist = $artist; album = $album; thumb = $thumb
    duration = [math]::Max(0, $duration); position = [math]::Max(0, $position)
    shuffle = $info.IsShuffleActive; repeat = $repeat
    canRepeat = [bool]$info.Controls.IsRepeatEnabled
  }
}

function Invoke-Control($s, $action, $value) {
  if ($action -eq 'play') { $op = $s.TryPlayAsync() }
  elseif ($action -eq 'pause') { $op = $s.TryPauseAsync() }
  elseif ($action -eq 'toggle') { $op = $s.TryTogglePlayPauseAsync() }
  elseif ($action -eq 'next') { $op = $s.TrySkipNextAsync() }
  elseif ($action -eq 'previous') { $op = $s.TrySkipPreviousAsync() }
  elseif ($action -eq 'seek') {
    $start = $s.GetTimelineProperties().StartTime.Ticks
    $op = $s.TryChangePlaybackPositionAsync([long]($start + [double]$value * 10000000))
  }
  elseif ($action -eq 'shuffle') { $op = $s.TryChangeShuffleActiveAsync($value -eq 'true') }
  elseif ($action -eq 'repeat') { $op = $s.TryChangeAutoRepeatModeAsync($value) }
  else { throw "Unknown action $action" }
  $null = Await $op ([bool])
}

function Thumb($s) {
  $props = Props $s
  $data = $null
  if ($null -ne $props.Thumbnail) {
    $stream = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    try {
      if ($stream.Size -le 5MB) {
        $memory = New-Object System.IO.MemoryStream
        [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream).CopyTo($memory)
        $data = [Convert]::ToBase64String($memory.ToArray())
      }
    } finally { $stream.Dispose() }
  }
  $artist = [string]$props.Artist
  if (-not $artist) { $artist = [string]$props.AlbumArtist }
  @{ title = [string]$props.Title; artist = $artist; album = [string]$props.AlbumTitle; data = $data }
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $id = 0
  try {
    $req = ConvertFrom-Json $line
    $id = $req.id
    if ($initError) { throw $initError }
    if ($null -eq $manager) {
      $manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    }
    if ($req.cmd -eq 'list') { $result = @(Sessions | ForEach-Object { Describe $_ }) }
    elseif ($req.cmd -eq 'control') { Invoke-Control (Find $req.source) $req.action $req.value; $result = $true }
    elseif ($req.cmd -eq 'thumb') { $result = Thumb (Find $req.source) }
    else { throw "Unknown command $($req.cmd)" }
    $out = @{ id = $id; result = $result }
  } catch {
    $out = @{ id = $id; error = $_.Exception.Message; unsupported = [bool]$initError }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $out -Compress -Depth 5))
  [Console]::Out.Flush()
}
`;

interface Session {
  source: string;
  status: string;
  title: string;
  artist: string;
  album: string;
  thumb: boolean;
  duration: number;
  position: number;
  shuffle: boolean | null;
  repeat: "None" | "Track" | "List" | null;
  canRepeat: boolean;
}

interface Thumb {
  title: string;
  artist: string;
  album: string;
  data: string | null;
}

class Unsupported extends Error {}

const IDLE_MS = 30_000;
const REQUEST_MS = 15_000;

/** The PowerShell process, started on demand. */
class Host {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private idle: NodeJS.Timeout | null = null;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();

  request(body: Record<string, unknown>): Promise<unknown> {
    const child = this.start();
    const id = this.nextId++;
    if (this.idle !== null) clearTimeout(this.idle);
    this.idle = setTimeout(() => this.fail(new Error("PowerShell stopped.")), IDLE_MS);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new Error("PowerShell did not answer in time.")),
        REQUEST_MS,
      );
      this.pending.set(id, { resolve, reject, timer });
      // ASCII only: PowerShell reads stdin in the console code page.
      const json = JSON.stringify({ ...body, id }).replace(
        /[\u0080-\uffff]/g,
        (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
      );
      child.stdin.write(`${json}\n`);
    });
  }

  private start(): ChildProcessWithoutNullStreams {
    if (this.child !== null) return this.child;
    const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
      { windowsHide: true, stdio: "pipe" },
    );
    this.child = child;
    createInterface({ input: child.stdout }).on("line", (line) => this.reply(line));
    child.stderr.resume();
    // A write after PowerShell stops fails with EPIPE; the exit handler cleans up.
    child.stdin.on("error", () => {});
    // Ignore a child that already stopped; a newer one may serve requests.
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (this.child !== child) return;
      this.fail(
        error.code === "ENOENT"
          ? new Unsupported("Now Playing needs Windows PowerShell (powershell.exe) on the bb server.")
          : error,
      );
    });
    child.on("exit", () => {
      if (this.child === child) this.fail(new Error("PowerShell stopped."));
    });
    return child;
  }

  private reply(line: string) {
    let message: { id?: number; result?: unknown; error?: string; unsupported?: boolean };
    try {
      message = JSON.parse(line.replace(/^\uFEFF/, ""));
    } catch {
      return;
    }
    const entry = message.id === undefined ? undefined : this.pending.get(message.id);
    if (entry === undefined) return;
    this.pending.delete(message.id!);
    clearTimeout(entry.timer);
    if (message.error === undefined) entry.resolve(message.result);
    else if (message.unsupported) {
      entry.reject(new Unsupported(`Windows media controls are not available: ${message.error}`));
    } else entry.reject(new Error(message.error));
  }

  private fail(error: Error) {
    if (this.idle !== null) clearTimeout(this.idle);
    this.idle = null;
    const child = this.child;
    this.child = null;
    child?.stdin.end();
    child?.kill();
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }
}

const NAMES: [RegExp, string][] = [
  [/spotify/i, "Spotify"],
  [/applemusic/i, "Apple Music"],
  [/zunemusic|mediaplayer/i, "Media Player"],
  [/msedge/i, "Edge"],
  [/chrome/i, "Chrome"],
  // Firefox registers under a hash of its install path.
  [/firefox|308046B0AF4A39CB/i, "Firefox"],
  [/brave/i, "Brave"],
  [/opera/i, "Opera"],
  [/vlc/i, "VLC"],
  [/foobar/i, "foobar2000"],
  [/tidal/i, "TIDAL"],
];

function displayName(source: string): string {
  const known = NAMES.find(([pattern]) => pattern.test(source));
  if (known !== undefined) return known[1];
  const base = source.split(/[!#]/)[0]!.split("_")[0]!.replace(/\.exe$/i, "");
  return base.split(/[.\\]/).pop() || "A music player";
}

function appOf(source: string): MusicApp {
  if (/spotify/i.test(source)) return "spotify";
  if (/applemusic/i.test(source)) return "music";
  return "other";
}

const FROM_REPEAT: Record<string, RepeatMode> = { None: "off", List: "all", Track: "one" };
const TO_REPEAT: Record<RepeatMode, string> = { off: "None", all: "List", one: "Track" };

function controlValue(action: Control): string {
  switch (action.action) {
    case "seek":
      return String(action.positionSec);
    case "shuffle":
      return String(action.on);
    case "repeat":
      return TO_REPEAT[action.mode];
    default:
      return "";
  }
}

const trackKey = (source: string, artist: string, title: string, album: string) =>
  artworkKey(source, artist, title, album);

function toPlayer(session: Session): Extract<Player, { status: "ready" }> {
  const status = session.status.toLowerCase();
  const track: Track | null =
    session.title === ""
      ? null
      : {
          id: `${session.source}\u0000${session.artist}\u0000${session.title}\u0000${session.album}`,
          name: session.title,
          artist: session.artist,
          album: session.album,
          durationSec: session.duration,
          artwork: session.thumb
            ? { kind: "local", key: trackKey(session.source, session.artist, session.title, session.album) }
            : null,
        };
  return {
    status: "ready",
    app: appOf(session.source),
    appName: displayName(session.source),
    source: session.source,
    state: status === "playing" ? "playing" : status === "paused" ? "paused" : "stopped",
    track,
    positionSec: session.position,
    // SMTC has no volume; Windows sets it per app in the volume mixer.
    volume: null,
    shuffling: session.shuffle === true,
    repeat: session.repeat === null ? "off" : (FROM_REPEAT[session.repeat] ?? "off"),
    repeatModes: session.repeat === null && !session.canRepeat ? ["off"] : ["off", "all", "one"],
  };
}

export function createWindowsBackend(): Backend {
  const host = new Host();
  // Artwork keys the panel may ask for, mapped to the player that showed them.
  const artSources = new Map<string, string>();

  async function list() {
    const sessions = (await host.request({ cmd: "list" })) as Session[] | null;
    return (sessions ?? []).map(toPlayer).map((player) => ({
      ...player,
      playing: player.state === "playing",
    }));
  }

  return {
    async player(action, preference, hint) {
      let players;
      try {
        players = await list();
      } catch (cause) {
        if (cause instanceof Unsupported) return { status: "unsupported", reason: cause.message };
        throw cause;
      }
      let pick = pickPlayer(players, preference, hint);
      // Windows has no simple way to open a given player, so the panel
      // offers no launch button.
      if (pick === null) return { status: "not-running", launchApp: null };
      if (action !== "state" && action.action === "volume") {
        throw new Error("Windows media controls cannot set a player's volume.");
      }
      if (action !== "state") {
        await host.request({ cmd: "control", source: pick.source, action: action.action, value: controlValue(action) });
        await sleep(250);
        const source = pick.source;
        pick = (await list()).find((player) => player.source === source) ?? pick;
      }
      const { playing: _, ...player } = pick;
      if (player.track?.artwork?.kind === "local") {
        artSources.delete(player.track.artwork.key);
        artSources.set(player.track.artwork.key, player.source);
        if (artSources.size > 20) artSources.delete(artSources.keys().next().value!);
      }
      return player;
    },

    async localArtwork(key) {
      const source = artSources.get(key);
      if (source === undefined) return null;
      const thumb = (await host.request({ cmd: "thumb", source })) as Thumb;
      // The track may have changed since the panel asked.
      if (thumb.data === null || trackKey(source, thumb.artist, thumb.title, thumb.album) !== key) return null;
      return imageDataUrl(Buffer.from(thumb.data, "base64"));
    },
  };
}
