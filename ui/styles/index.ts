import type { ComponentType } from "react";
import type { PlayerStyle } from "../../shared";
import { CoverStyle } from "./cover";
import { DefaultStyle } from "./default";
import { HiFiStyle } from "./hifi";
import { MinimalStyle } from "./minimal";
import { PocketStyle } from "./pocket";
import { TerminalStyle } from "./terminal";
import type { StyleProps } from "./types";
import { WinampStyle } from "./winamp";

export type { StyleProps } from "./types";

interface StyleInfo {
  label: string;
  component: ComponentType<StyleProps>;
  /** The style draws its own case, so the panel drops bb's frame. */
  frameless: boolean;
}

export const STYLE_INFO: Record<PlayerStyle, StyleInfo> = {
  default: { label: "Default", component: DefaultStyle, frameless: false },
  minimal: { label: "Minimal", component: MinimalStyle, frameless: false },
  cover: { label: "Cover", component: CoverStyle, frameless: true },
  hifi: { label: "Hi-Fi", component: HiFiStyle, frameless: true },
  terminal: { label: "Terminal", component: TerminalStyle, frameless: true },
  pocket: { label: "Pocket", component: PocketStyle, frameless: true },
  winamp: { label: "Winamp", component: WinampStyle, frameless: true },
};
