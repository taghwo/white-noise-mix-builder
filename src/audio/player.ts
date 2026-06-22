import { type ChildProcess, spawn } from "node:child_process";
import type { Backend } from "./backend.js";

/**
 * Plays a single sound file on a loop at a controllable volume.
 *
 * For backends that loop natively (ffplay, sox) one child process runs
 * forever. For backends that don't (afplay) the process is respawned each
 * time it exits, producing a seamless-enough loop. The silent backend tracks
 * state only and spawns nothing.
 */
export class Player {
  private proc: ChildProcess | undefined;
  private stopped = false;

  constructor(
    private readonly backend: Backend,
    private readonly file: string,
    private volume: number,
  ) {}

  start(): this {
    this.stopped = false;
    this.spawn();
    return this;
  }

  /** Change volume live; restarts the underlying process to apply it. */
  setVolume(volume: number): void {
    this.volume = volume;
    if (this.stopped) return;
    this.respawn();
  }

  get currentVolume(): number {
    return this.volume;
  }

  /** True while playback is active (or would be, for the silent backend). */
  get playing(): boolean {
    return !this.stopped;
  }

  stop(): void {
    this.stopped = true;
    this.kill();
  }

  private spawn(): void {
    if (this.backend.silent) return;
    const args = this.backend.buildArgs(this.file, this.volume);
    const proc = spawn(this.backend.command, args, { stdio: "ignore" });
    this.proc = proc;
    proc.on("exit", () => {
      if (proc !== this.proc) return; // superseded by a respawn
      this.proc = undefined;
      // Loop manually for non-native backends until told to stop.
      if (!this.stopped && !this.backend.nativeLoop) this.spawn();
    });
    // A spawn failure (missing binary) shouldn't crash the app.
    proc.on("error", () => {
      if (proc === this.proc) this.proc = undefined;
    });
  }

  private respawn(): void {
    this.kill();
    this.spawn();
  }

  private kill(): void {
    const proc = this.proc;
    this.proc = undefined;
    if (proc && !proc.killed) proc.kill();
  }
}
