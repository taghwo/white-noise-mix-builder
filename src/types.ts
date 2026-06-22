/** A single environmental sound available to layer into a mix. */
export interface Sound {
  /** Stable id used in presets and the CLI, e.g. "rain". Do not rename. */
  id: string;
  label: string;
  /** Absolute path to the audio file. */
  file: string;
  icon?: string;
  license?: string;
  attribution?: string;
  /** True when discovered in the user's sounds folder rather than bundled. */
  user?: boolean;
}

/** Raw shape of an entry inside assets/sounds/manifest.json. */
export interface ManifestEntry {
  id: string;
  label: string;
  file: string;
  icon?: string;
  license?: string;
  attribution?: string;
}

/** One layer in a mix: a sound plus its volume (0..1). */
export interface Layer {
  soundId: string;
  /** Linear volume, 0 (silent) to 1 (full). */
  volume: number;
  /** Silenced without losing the volume setting. */
  muted: boolean;
}

/** A saved, named combination of layers. */
export interface Preset {
  name: string;
  layers: Layer[];
  updatedAt: string;
}
