import type { PlayerActions, ReadyPlayer } from "../player";
import type { Hex, Theme } from "../theme";

export interface StyleProps {
  player: ReadyPlayer;
  actions: PlayerActions;
  theme: Theme;
  /** The resolved accent; styles without an accent ignore it. */
  accent: Hex;
  artworkUrl: string | null;
}
