# bb-plugin-spotify

A bb plugin that controls the Spotify desktop app from a small panel in the
sidebar footer.

- `server.ts` — runs JavaScript for Automation (`osascript -l JavaScript`)
  against Spotify. It exposes two RPC methods (`player_state`,
  `player_control`) and the `bb spotify` CLI command.
- `app.tsx` — registers a sidebar-footer disclosure. The panel polls the
  player once a second while it is open and the page is visible.
- `skills/spotify/SKILL.md` — tells agents how to use `bb spotify`.
- `assets/music.svg` — the plugin icon and the footer glyph (`spotify/music`).

## Install

```
bb plugin install git:https://github.com/chrisabra-co/bb-plugin-spotify.git@^0.1.0
```

## Requirements

- The bb server runs on macOS.
- The Spotify desktop app is installed.
- bb has Automation permission for Spotify. macOS asks on the first call.
  To change it later, open System Settings → Privacy & Security → Automation.

## Develop

```
npm install --include=dev
bb plugin install .
bb plugin dev
```
