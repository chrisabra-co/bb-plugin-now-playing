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
macOS Automation, so it needs no account link or API key. The first time the
plugin controls an app, macOS asks if bb can control it.

Streamed Apple Music tracks do not share their album art with other apps. To
show it, the server asks Apple's public iTunes Search API for the cover. It
sends only the artist and the track title. A setting turns this lookup off.
Library tracks use their own art, with no lookup.

The player works from any bb client, but it always controls the server's
Mac.

## Limits

- The bb server must run on macOS. Spotify needs its desktop app.
- The plugin cannot search for music or start a playlist. Pick music in the
  app.
- Spotify has no "repeat one" mode, so repeat turns on or off there.
- When the iTunes Search API has no match by the same artist, a streamed
  Apple Music track shows a music note.
