import { loadLibrary } from "../library.js";
import type { Layer, Sound } from "../types.js";
import { clamp01 } from "../util.js";
import type { Backend } from "./backend.js";
import { Player } from "./player.js";

/**
 * Manages a set of concurrently playing sound layers, each with its own
 * volume and mute state, plus a master volume applied across all of them.
 */
export class Mixer {
  private readonly layers = new Map<string, Layer>();
  private readonly players = new Map<string, Player>();
  private master: number;

  constructor(
    private readonly backend: Backend,
    private readonly library: Sound[] = loadLibrary(),
    master = 1,
  ) {
    this.master = clamp01(master);
  }

  /** Volume actually sent to a player: master × layer, or 0 when muted. */
  private effective(layer: Layer): number {
    return layer.muted ? 0 : clamp01(layer.volume * this.master);
  }

  private sound(soundId: string): Sound | undefined {
    return this.library.find((s: Sound) => s.id === soundId);
  }

  /**
   * Add a layer and start playing it. Returns false if the sound id is
   * unknown; re-adding an existing layer just updates its volume.
   */
  addLayer(soundId: string, volume = 0.5): boolean {
    const sound = this.sound(soundId);
    if (!sound) return false;

    const existing = this.layers.get(soundId);
    if (existing) {
      this.setVolume(soundId, volume);
      return true;
    }

    const layer: Layer = { soundId, volume: clamp01(volume), muted: false };
    this.layers.set(soundId, layer);
    const player = new Player(this.backend, sound.file, this.effective(layer));
    player.start();
    this.players.set(soundId, player);
    return true;
  }

  removeLayer(soundId: string): void {
    this.players.get(soundId)?.stop();
    this.players.delete(soundId);
    this.layers.delete(soundId);
  }

  /** Set a layer's own volume (0..1). No-op for unknown layers. */
  setVolume(soundId: string, volume: number): void {
    const layer = this.layers.get(soundId);
    if (!layer) return;
    layer.volume = clamp01(volume);
    this.players.get(soundId)?.setVolume(this.effective(layer));
  }

  /** Nudge a layer's volume by `delta`, returning the new value. */
  adjustVolume(soundId: string, delta: number): number {
    const layer = this.layers.get(soundId);
    if (!layer) return 0;
    this.setVolume(soundId, layer.volume + delta);
    return this.layers.get(soundId)!.volume;
  }

  setMuted(soundId: string, muted: boolean): void {
    const layer = this.layers.get(soundId);
    if (!layer) return;
    layer.muted = muted;
    this.players.get(soundId)?.setVolume(this.effective(layer));
  }

  /** Toggle mute, returning the new mute state. */
  toggleMute(soundId: string): boolean {
    const layer = this.layers.get(soundId);
    if (!layer) return false;
    this.setMuted(soundId, !layer.muted);
    return layer.muted;
  }

  /** Set master volume (0..1), reapplying it to every active layer. */
  setMaster(volume: number): void {
    this.master = clamp01(volume);
    for (const [soundId, layer] of this.layers) {
      this.players.get(soundId)?.setVolume(this.effective(layer));
    }
  }

  get masterVolume(): number {
    return this.master;
  }

  has(soundId: string): boolean {
    return this.layers.has(soundId);
  }

  /** Immutable snapshot of the current layers (UI reads this). */
  getLayers(): Layer[] {
    return [...this.layers.values()].map((l: Layer) => ({ ...l }));
  }

  /** Replace all layers with the given set (used to load a preset). */
  loadLayers(layers: Layer[]): void {
    this.stopAll();
    for (const layer of layers) {
      if (this.addLayer(layer.soundId, layer.volume) && layer.muted) {
        this.setMuted(layer.soundId, true);
      }
    }
  }

  /** Stop every layer and clear the mix. */
  stopAll(): void {
    for (const player of this.players.values()) player.stop();
    this.players.clear();
    this.layers.clear();
  }
}
