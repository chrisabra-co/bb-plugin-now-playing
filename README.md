# bb-plugin-now-playing

A bb plugin that controls the music player on the bb server from a small
panel in the sidebar footer. It works on macOS, Linux, and Windows.

- `server.ts` — exposes the player RPC methods (`player_state`,
  `player_control`, `player_artwork`), the appearance methods
  (`appearance_get`, `appearance_set`), the `app` setting, and the
  `bb music` CLI command. It picks a backend for the server's platform.
- `backends/macos.ts` — runs JavaScript for Automation
  (`osascript -l JavaScript`) against Spotify or Music. Music library artwork
  comes from AppleScript as raw bytes; the server shrinks it with `sips` and
  sends it as a data URL. Streamed Music tracks have no artwork in
  scripting, so the server looks up the cover with the iTunes Search API
  (artist and title only). The `artworkLookup` setting turns that off.
- `backends/linux.ts` — controls any MPRIS player (Spotify, browsers, VLC,
  and others) with `playerctl`.
- `backends/windows.ts` — controls any app in the Windows media overlay
  through the System Media Transport Controls. One PowerShell process runs
  the WinRT calls and stops after 30 seconds with no request.
- `player-schema.ts` — the player state and controls that each backend
  returns.
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

- macOS: Spotify (desktop app) or Apple Music. bb needs Automation
  permission for each app. macOS asks on the first call. To change it later,
  open System Settings → Privacy & Security → Automation.
- Linux: `playerctl` (for example `sudo apt install playerctl`). The bb
  server must reach the desktop session's D-Bus. If
  `DBUS_SESSION_BUS_ADDRESS` is not set, the server tries
  `/run/user/<uid>/bus`.
- Windows: Windows 10 1809 or later, with Windows PowerShell. Windows media
  controls have no volume, so the panel hides the volume control.

## Develop

```
npm install --include=dev
bb plugin install .
bb plugin dev
```
