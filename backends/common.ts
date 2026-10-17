// What every platform backend provides, and helpers they share.
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import type { AppPreference, Control, MusicApp, Player, Track } from "../player-schema";

export interface Backend {
  /**
   * Reads the player, or sends `action` and then reads it. `hint` is the
   * `source` of the player used last; "auto" prefers it.
   */
  player(action: "state" | Control, preference: AppPreference, hint: string): Promise<Player>;
  /** The image for a "local" artwork key as a data URL, or null. */
  localArtwork(key: string, track: Track): Promise<string | null>;
}

export interface Candidate {
  source: string;
  app: MusicApp;
  playing: boolean;
}

/**
 * Picks the player to control: with "auto", a playing player first, then
 * any player, with the hint first in each group. Spotify and Apple Music
 * settings keep only that app.
 */
export function pickPlayer<C extends Candidate>(
  candidates: C[],
  preference: AppPreference,
  hint: string,
): C | null {
  const allowed = candidates.filter((c) => preference === "auto" || c.app === preference);
  const order = (list: C[]) => [
    ...list.filter((c) => c.source === hint),
    ...list.filter((c) => c.source !== hint),
  ];
  return order(allowed.filter((c) => c.playing))[0] ?? order(allowed)[0] ?? null;
}

/** A short hex key (player_artwork accepts 1–32 hex characters). */
export const artworkKey = (...parts: string[]) =>
  createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 32);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function imageType(bytes: Buffer): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") {
    return "image/webp";
  }
  if (bytes.subarray(0, 3).toString() === "GIF") return "image/gif";
  return null;
}

/** An image as a data URL, if it is a known image type and not too large. */
export function imageDataUrl(bytes: Buffer): string | null {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  const type = imageType(bytes);
  return type === null ? null : `data:${type};base64,${bytes.toString("base64")}`;
}

export async function fileDataUrl(path: string): Promise<string | null> {
  const info = await stat(path).catch(() => null);
  if (info === null || !info.isFile() || info.size > MAX_IMAGE_BYTES) return null;
  return imageDataUrl(await readFile(path));
}

export function execText(
  cmd: string,
  args: string[],
  options: { timeout?: number; maxBuffer?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: options.timeout ?? 15_000, maxBuffer: options.maxBuffer ?? 1024 * 1024, env: options.env },
      (error, stdout, stderr) => {
        if (error === null) resolve({ stdout, stderr });
        else reject(Object.assign(error, { stdout, stderr }));
      },
    );
  });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
