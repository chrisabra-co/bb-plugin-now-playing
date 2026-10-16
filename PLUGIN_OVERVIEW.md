Control Spotify without leaving bb.

## What you get

- A **Spotify** button in the sidebar footer. It opens a small player with
  the track, artwork, a seek bar, play and pause, previous and next, shuffle,
  repeat, and volume.
- A `bb spotify` command that does the same from a terminal or an agent.

## How it works

The plugin drives the Spotify desktop app on the Mac that runs the bb server.
It uses macOS Automation, so it needs no Spotify account link, API key, or
network call. The first time it runs, macOS asks if bb can control Spotify.

The player works from any bb client, including a phone, but it always
controls the server's Mac.

## Limits

- The bb server must run on macOS with the Spotify app installed.
- The plugin cannot search for music or start a playlist. Pick music in
  Spotify.
