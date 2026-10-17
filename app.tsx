// bb-plugin-now-playing — a small Spotify or Apple Music player in the
// sidebar footer, in one of several styles.
//
// Compiled by `bb plugin build` into dist/app.js + dist/app.css. React and
// @get-bb/plugin-sdk/app come from the BB app at load time.
import "./styles.css";
import type { ReactNode } from "react";
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { hasAccent } from "./shared";
import { Button } from "@/components/ui/button";
import { PlayGlyph } from "./ui/glyphs";
import type { ReadyPlayer } from "./ui/player";
import {
  APP_NAMES,
  useAppearance,
  useArtworkUrl,
  usePlayer,
  usePlayerActions,
} from "./ui/player";
import { PlayerStyleSettings } from "./ui/settings";
import { STYLE_INFO } from "./ui/styles";
import { accentColor, useTheme } from "./ui/theme";
import type { Appearance, Control } from "./server";

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="status" className="space-y-2 py-1 text-xs text-muted-foreground">
      <p>{children}</p>
      {action}
    </div>
  );
}

function StyledPlayer({
  player,
  appearance,
  send,
}: {
  player: ReadyPlayer;
  appearance: Appearance;
  send: (control: Control) => void;
}) {
  const theme = useTheme();
  const actions = usePlayerActions(player, send);
  const artworkUrl = useArtworkUrl(player.track?.artwork ?? null);
  const { style } = appearance;
  const Style = STYLE_INFO[style].component;
  const accent = hasAccent(style)
    ? accentColor(style, appearance.accents[style], theme)
    : theme.primary;
  return (
    <Style player={player} actions={actions} theme={theme} accent={accent} artworkUrl={artworkUrl} />
  );
}

function NowPlayingPanel() {
  const { player, error, send } = usePlayer();
  const { appearance } = useAppearance();
  let body: ReactNode;
  // Styles that draw their own case fill the panel without bb's frame.
  let frameless = false;
  if (player === null) {
    body = error === null ? <Notice>Connecting…</Notice> : null;
  } else if (player.status === "unsupported") {
    body = <Notice>{player.reason ?? "Now Playing needs a bb server on macOS, Linux, or Windows."}</Notice>;
  } else if (player.status === "not-installed") {
    body = <Notice>{APP_NAMES[player.app]} is not installed on the bb server.</Notice>;
  } else if (player.status === "not-running") {
    const { launchApp } = player;
    body = (
      <Notice
        action={
          launchApp === null ? undefined : (
            <Button size="sm" onClick={() => send({ action: "play" })}>
              <PlayGlyph />
              Open {APP_NAMES[launchApp]}
            </Button>
          )
        }
      >
        {launchApp === null ? "Start a song in any music player on the bb server." : "No music app is running."}
      </Notice>
    );
  } else if (appearance === null) {
    // Wait for the stored style, so the panel does not flash the default.
    body = null;
  } else {
    frameless = STYLE_INFO[appearance.style].frameless;
    body = <StyledPlayer player={player} appearance={appearance} send={send} />;
  }
  return (
    <div className={frameless ? "np-panel np-frameless w-full" : "np-panel w-full p-3"}>
      {body}
      {error === null ? null : (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export default definePluginApp((app) => {
  app.experimental_sidebarFooter.register({
    kind: "disclosure",
    id: "player",
    label: "Now Playing",
    icon: "now-playing/music",
    component: NowPlayingPanel,
  });
  app.slots.settingsSection({
    id: "player-style",
    title: "Player style",
    description: "Pick how the Now Playing panel looks. The change shows at once in every bb window.",
    component: PlayerStyleSettings,
  });
});
