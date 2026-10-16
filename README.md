# bb-plugin-now-playing

A bb plugin that controls Spotify or Apple Music from a small panel in the
sidebar footer.

- `server.ts` — runs JavaScript for Automation (`osascript -l JavaScript`)
  against Spotify or Music. It exposes three RPC methods (`player_state`,
  `player_control`, `player_artwork`), the `app` setting, and the `bb music`
  CLI command. Music artwork comes from AppleScript as raw bytes; the server
  shrinks it with `sips` and sends it as a data URL.
- `app.tsx` — registers a sidebar-footer disclosure. The panel polls the
  player once a second while it is open and the page is visible.
- `skills/now-playing/SKILL.md` — tells agents how to use `bb music`.
- `assets/music.svg` — the plugin icon and the footer glyph (`now-playing/music`).

## Install

```
bb plugin install git:https://github.com/chrisabra-co/bb-plugin-now-playing.git@^0.2.0
```

## Requirements

- The bb server runs on macOS.
- Spotify (desktop app) or Apple Music. Music ships with macOS.
- bb has Automation permission for each app. macOS asks on the first call.
  To change it later, open System Settings → Privacy & Security → Automation.

## Develop

```
npm install --include=dev
bb plugin install .
bb plugin dev
```
