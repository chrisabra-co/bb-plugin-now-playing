---
name: spotify
description: Control the Spotify app on the bb server's Mac with the `bb spotify` CLI. Use when the user asks to play, pause, skip, change the volume, toggle shuffle or repeat, or asks what is playing.
---

# Spotify

The Spotify plugin controls the Spotify desktop app on the Mac that runs the
bb server. The Spotify panel in the sidebar footer and `bb spotify` control
the same player.

## Commands

| Command | Effect |
| --- | --- |
| `bb spotify status` | Show the track, position, volume, shuffle, and repeat. |
| `bb spotify play` | Start playback. Opens Spotify when it is not running. |
| `bb spotify pause` | Pause playback. |
| `bb spotify toggle` | Play or pause. Opens Spotify when it is not running. |
| `bb spotify next` | Skip to the next track. |
| `bb spotify previous` | Go to the previous track. |
| `bb spotify volume <0-100>` | Set the volume. |
| `bb spotify shuffle on\|off` | Turn shuffle on or off. |
| `bb spotify repeat on\|off` | Turn repeat on or off. |

Add `--json` to any command when the output drives code.

## Rules

- Change playback only when the user asks for it. Music plays out loud.
- Run `bb spotify status` to answer "what is playing". Do not guess.
- The plugin cannot search or pick a song. Tell the user to choose it in
  Spotify.
- An error that names "Automation" means macOS blocked bb. Tell the user to
  allow bb to control Spotify in System Settings → Privacy & Security →
  Automation.
