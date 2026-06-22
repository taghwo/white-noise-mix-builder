import { spawnSync } from "node:child_process";
import { clamp01 } from "../util.js";

/** A playback engine we can shell out to, or the silent no-op fallback. */
export interface Backend {
  name: string;
  /** True when the engine loops a file on its own (no respawn needed). */
  nativeLoop: boolean;
  /** True for the silent fallback that produces no sound. */
  silent: boolean;
  /** Executable to run (empty for the silent backend). */
  command: string;
  /**
   * Build the argument list to play `file` once (or forever, if nativeLoop)
   * at linear `volume` (0..1).
   */
  buildArgs(file: string, volume: number): string[];
}

function isInstalled(command: string): boolean {
  // A missing binary sets `error` (ENOENT); if it ran at all the binary
  // exists, even when `-version` isn't a valid flag and it exits non-zero.
  const probe = spawnSync(command, ["-version"], { stdio: "ignore" });
  return probe.status === 0 || probe.error === undefined;
}

const ffplay: Backend = {
  name: "ffplay",
  nativeLoop: true,
  silent: false,
  command: "ffplay",
  buildArgs: (file, volume) => [
    "-nodisp",
    "-autoexit",
    "-loglevel",
    "quiet",
    "-loop",
    "0",
    "-af",
    `volume=${clamp01(volume).toFixed(3)}`,
    file,
  ],
};

const sox: Backend = {
  name: "sox",
  nativeLoop: true,
  silent: false,
  command: "play",
  buildArgs: (file, volume) => [
    "-q",
    file,
    "vol",
    clamp01(volume).toFixed(3),
    "repeat",
    "999999",
  ],
};

const afplay: Backend = {
  name: "afplay",
  nativeLoop: false,
  silent: false,
  command: "afplay",
  buildArgs: (file, volume) => ["-v", clamp01(volume).toFixed(3), file],
};

export const silentBackend: Backend = {
  name: "silent",
  nativeLoop: true,
  silent: true,
  command: "",
  buildArgs: () => [],
};

/** Detection order: richest/most-portable first, silent last. */
const candidates: Backend[] = [ffplay, sox, afplay];

let cached: Backend | undefined;
/** True when we landed on silent only because no real player was found. */
let autoSilent = false;

export function detectBackend(force = process.env.WNM_BACKEND): Backend {
  if (force) {
    if (force === "silent") return silentBackend; // intentional, not a fallback
    const match = candidates.find((b: Backend) => b.name === force);
    if (match) return match;
  }
  if (cached) return cached;
  const found = candidates.find((b: Backend) => isInstalled(b.command));
  autoSilent = found === undefined;
  cached = found ?? silentBackend;
  return cached;
}

export function silentFallbackHint(): string | undefined {
  if (!autoSilent) return undefined;
  return (
    "No audio player found, so the mix is silent. Install one to hear it: " +
    "ffmpeg (ffplay) or sox. On macOS, afplay is normally built in."
  );
}

/** Reset the detection cache (used in tests). */
export function resetBackendCache(): void {
  cached = undefined;
  autoSilent = false;
}
