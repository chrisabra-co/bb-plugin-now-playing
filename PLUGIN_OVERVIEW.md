Control your music without leaving bb.

## What you get

- A **Now Playing** button in the sidebar footer. It opens a small player
  with the track, album art, a seek bar, play and pause, previous and next,
  shuffle, repeat, and volume.
- Support for Spotify and Apple Music. By default the player follows the app
  that is playing. A setting can lock it to one app.
- A `bb music` command that does the same from a terminal or an agent.

## How it works

The plugin drives the music app on the Mac that runs the bb server. It uses
macOS Automation, so it needs no account link, API key, or network call.
The first time the plugin controls
an app, macOS asks if bb can control it.

The player works from any bb client, but it always controls the server's
Mac.

## Limits

- The bb server must run on macOS. Spotify needs its desktop app.
- The plugin cannot search for music or start a playlist. Pick music in the
  app.
- Spotify has no "repeat one" mode, so repeat turns on or off there.
- Apple Music shows album art only for tracks in your library. A streamed
  track shows a music note, because Music does not share its art.
