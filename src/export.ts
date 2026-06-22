import { findSound } from "./library.js";
import type { Layer, Sound } from "./types.js";
import { decodeWav, encodeWav } from "./wav.js";

export interface ExportResult {
  file: string;
  seconds: number;
  layers: number;
  sampleRate: number;
  /** Scale factor applied to keep the mix from clipping (<1 means reduced). */
  gain: number;
}

/** Nearest-neighbour resample of mono samples to a new rate. */
function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples;
  const ratio = from / to;
  const out = new Float32Array(Math.round(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    out[i] = samples[Math.floor(i * ratio)] ?? 0;
  }
  return out;
}

/**
 * Render a set of layers into a single mono 16-bit WAV of `seconds` length.
 * Each non-muted layer is looped to fill the duration, scaled by its volume,
 * summed, then gain-corrected so the peak never clips.
 *
 * Pure Node, WAV-only — needs no ffmpeg/sox. Returns an error message string
 * instead of throwing for the common "unsupported input" cases.
 */
export function exportMix(
  layers: Layer[],
  outFile: string,
  seconds: number,
  library?: Sound[],
): ExportResult | { error: string } {
  const active = layers.filter((l: Layer) => !l.muted && l.volume > 0);
  if (active.length === 0) return { error: "Nothing to export — no audible layers." };

  // Decode every layer up front so we can fail fast on bad inputs.
  const decoded: { samples: Float32Array; sampleRate: number; volume: number }[] = [];
  for (const layer of active) {
    const sound = findSound(layer.soundId, library);
    if (!sound) return { error: `Unknown sound: ${layer.soundId}` };
    if (!sound.file.toLowerCase().endsWith(".wav")) {
      return {
        error:
          `Cannot export "${sound.label}": only .wav sources are supported by ` +
          `the built-in renderer. Convert it to WAV first (e.g. with ffmpeg).`,
      };
    }
    try {
      const d = decodeWav(sound.file);
      decoded.push({ ...d, volume: layer.volume });
    } catch (err) {
      return { error: `Failed to read ${sound.label}: ${(err as Error).message}` };
    }
  }

  const sampleRate = decoded[0]!.sampleRate;
  const total = Math.max(1, Math.round(seconds * sampleRate));
  const mix = new Float32Array(total);

  for (const layer of decoded) {
    const src = resample(layer.samples, layer.sampleRate, sampleRate);
    if (src.length === 0) continue;
    for (let i = 0; i < total; i++) {
      mix[i] = (mix[i] ?? 0) + (src[i % src.length] ?? 0) * layer.volume;
    }
  }

  // Gain-correct so the loudest sample sits at ~0.99 (only attenuates).
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(mix[i] ?? 0));
  const gain = peak > 0.99 ? 0.99 / peak : 1;
  if (gain !== 1) for (let i = 0; i < total; i++) mix[i] = (mix[i] ?? 0) * gain;

  encodeWav(outFile, mix, sampleRate);
  return { file: outFile, seconds, layers: active.length, sampleRate, gain };
}
