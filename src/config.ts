import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Root of the user's data directory (presets + custom sounds).
 * Honors WNM_HOME for tests and portable installs.
 */
export const userHome: string =
  process.env.WNM_HOME ?? path.join(os.homedir(), ".white-noise-mix");

export const presetsDir: string = path.join(userHome, "presets");

/** Files dropped in here are auto-discovered as sounds. */
export const userSoundsDir: string = path.join(userHome, "sounds");

/**
 * Bundled assets ship alongside the source. At runtime this file lives in
 * either src/ (dev via tsx) or dist/ (built), both one level under the
 * package root, so assets/ resolves the same way.
 */
export const bundledSoundsDir: string = path.resolve(
  __dirname,
  "..",
  "assets",
  "sounds",
);

export const supportedExtensions: readonly string[] = [
  ".wav",
  ".mp3",
  ".ogg",
  ".flac",
  ".m4a",
  ".aiff",
];
