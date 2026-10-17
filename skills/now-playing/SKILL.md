---
name: now-playing
description: Control the music player on the bb server (Spotify, Apple Music, or another player on Linux and Windows) with the `bb music` CLI. Use when the user asks to play, pause, skip, change the volume, toggle shuffle or repeat, switch between Spotify and Apple Music, change the player style, or asks what is playing.
---

# Now Playing

The Now Playing plugin controls the music player on the computer that runs
the bb server. On macOS it controls Spotify or Apple Music. On Linux and
Windows it controls any player that reports to the system, such as Spotify,
a browser, or VLC. The Now Playing panel in the sidebar footer and `bb music`
control the same player.

## Which app it controls

The `app` setting picks the app. The default, `auto`, controls the player
that is playing. When none plays, it controls a running player, and prefers
the player used last. Run `bb music app` to see the setting.

## Commands

| Command | Effect |
| --- | --- |
| `bb music status` | Show the app, track, position, volume, shuffle, and repeat. |
| `bb music play` | Start playback. On macOS and Linux, opens an app when none is running. |
| `bb music pause` | Pause playback. |
| `bb music toggle` | Play or pause. On macOS and Linux, opens an app when none is running. |
| `bb music next` | Skip to the next track. |
| `bb music previous` | Go to the previous track. |
| `bb music volume <0-100>` | Set the app's volume. Windows does not support it. |
| `bb music shuffle on\|off` | Turn shuffle on or off. |
| `bb music repeat off\|all\|one` | Set repeat. Spotify treats `one` as `all`. |
| `bb music app [auto\|spotify\|music]` | Show or set the app to control. |
| `bb music style [name]` | Show or set the panel style: `default`, `minimal`, `cover`, `hifi`, `terminal`, `pocket`, or `bbamp`. |

Add `--json` to any command when the output drives code.

## Rules

- Change playback only when the user asks for it. Music plays out loud.
- Change the `app` setting or the style only when the user asks for it.
- Run `bb music status` to answer "what is playing". Do not guess.
- The panel finds art for streamed Apple Music tracks with Apple's iTunes
  Search API. A music note means no match. That is not an error.
- The plugin cannot search for music or start a playlist. Tell the user to
  choose it in the app.
- On Linux, a message about `playerctl` means the server needs it. Tell the
  user to install it.
- An error that names "Automation" means macOS blocked bb. Tell the user to
  allow bb to control the app in System Settings → Privacy & Security →
  Automation.
