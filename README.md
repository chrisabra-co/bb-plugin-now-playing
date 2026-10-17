# bb-plugin-now-playing

A bb plugin that controls Spotify or Apple Music from a small panel in the
sidebar footer.

- `server.ts` — runs JavaScript for Automation (`osascript -l JavaScript`)
  against Spotify or Music. It exposes the player RPC methods
  (`player_state`, `player_control`, `player_artwork`), the appearance
  methods (`appearance_get`, `appearance_set`), the `app` setting, and the
  `bb music` CLI command. Music library artwork comes from AppleScript as raw bytes;
  the server shrinks it with `sips` and sends it as a data URL. Streamed
  Music tracks have no artwork in scripting, so the server looks up the cover
  with the iTunes Search API (artist and title only). The `artworkLookup`
  setting turns that off.
- `app.tsx` — registers a sidebar-footer disclosure and a "Player style"
  section on the plugin's settings page. The panel polls the player once a
  second while it is open and the page is visible.
- `ui/styles/` — the seven player styles: Default, Minimal, Cover, Hi-Fi,
  Terminal, Pocket, and bb-amp. The style and the accent colors are stored
  in the plugin's key-value storage, so every bb window shows the same look.
- `ui/theme.ts` — reads bb's canvas, ink, and primary colors and mixes the
  style colors from them, so each style fits light and dark themes. An
  accent that does not reach 4.5:1 contrast on its surface is adjusted.
- `styles.css` and `fonts.css` — the skin CSS and three pixel fonts
  (Silkscreen, VT323, Doto; SIL OFL 1.1, see `assets/fonts/OFL.txt`). The
  fonts are embedded as data URLs, so they load with no network call. Run
  `npm run fonts` after you change a file in `assets/fonts`.
- `skills/now-playing/SKILL.md` — tells agents how to use `bb music`.
- `assets/music.svg` — the plugin icon and the footer glyph (`now-playing/music`).

## Install

```
bb plugin install git:https://github.com/chrisabra-co/bb-plugin-now-playing.git@^0.3.0
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
