---
name: now-playing
description: Control Spotify or Apple Music on the bb server's Mac with the `bb music` CLI. Use when the user asks to play, pause, skip, change the volume, toggle shuffle or repeat, switch between Spotify and Apple Music, change the player style, or asks what is playing.
---

# Now Playing

The Now Playing plugin controls Spotify or Apple Music on the Mac that runs
the bb server. The Now Playing panel in the sidebar footer and `bb music`
control the same player.

## Which app it controls

The `app` setting picks the app. The default, `auto`, controls the app that
is playing. When neither plays, it controls the running app, and prefers the
app used last. Run `bb music app` to see the setting.

## Commands

| Command | Effect |
| --- | --- |
| `bb music status` | Show the app, track, position, volume, shuffle, and repeat. |
| `bb music play` | Start playback. Opens an app when none is running. |
| `bb music pause` | Pause playback. |
| `bb music toggle` | Play or pause. Opens an app when none is running. |
| `bb music next` | Skip to the next track. |
| `bb music previous` | Go to the previous track. |
| `bb music volume <0-100>` | Set the app's volume. |
| `bb music shuffle on\|off` | Turn shuffle on or off. |
| `bb music repeat off\|all\|one` | Set repeat. Spotify treats `one` as `all`. |
| `bb music app [auto\|spotify\|music]` | Show or set the app to control. |
| `bb music style [name]` | Show or set the panel style: `default`, `minimal`, `cover`, `hifi`, `terminal`, `pocket`, or `winamp`. |

Add `--json` to any command when the output drives code.

## Rules

- Change playback only when the user asks for it. Music plays out loud.
- Change the `app` setting or the style only when the user asks for it.
- Run `bb music status` to answer "what is playing". Do not guess.
- The panel finds art for streamed Apple Music tracks with Apple's iTunes
  Search API. A music note means no match. That is not an error.
- The plugin cannot search for music or start a playlist. Tell the user to
  choose it in the app.
- An error that names "Automation" means macOS blocked bb. Tell the user to
  allow bb to control the app in System Settings → Privacy & Security →
  Automation.
