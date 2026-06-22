import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportMix } from "../src/export.js";
import type { Layer, Sound } from "../src/types.js";
import { decodeWav, encodeWav } from "../src/wav.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wnm-export-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Write a short sine-ish tone WAV and return its path. */
function makeWav(name: string, value: number, frames = 4410): string {
  const samples = new Float32Array(frames).fill(value);
  const file = path.join(tmp, name);
  encodeWav(file, samples, 44100);
  return file;
}

describe("wav codec", () => {
  it("round-trips mono samples within 16-bit precision", () => {
    const file = makeWav("tone.wav", 0.5);
    const { sampleRate, samples } = decodeWav(file);
    expect(sampleRate).toBe(44100);
    expect(samples.length).toBe(4410);
    expect(samples[0]).toBeCloseTo(0.5, 2);
  });
});

describe("exportMix", () => {
  function library(): Sound[] {
    return [
      { id: "a", label: "A", file: makeWav("a.wav", 0.6) },
      { id: "b", label: "B", file: makeWav("b.wav", 0.6) },
      { id: "mp3", label: "Mp3", file: path.join(tmp, "x.mp3") },
    ];
  }

  it("renders layers to a WAV of the requested length", () => {
    const layers: Layer[] = [
      { soundId: "a", volume: 0.5, muted: false },
      { soundId: "b", volume: 0.5, muted: false },
    ];
    const out = path.join(tmp, "mix.wav");
    const result = exportMix(layers, out, 2, library());
    expect("file" in result).toBe(true);
    if ("file" in result) {
      expect(result.layers).toBe(2);
      const decoded = decodeWav(out);
      expect(decoded.samples.length).toBe(2 * 44100);
    }
  });

  it("applies gain to avoid clipping when layers sum above 1", () => {
    const layers: Layer[] = [
      { soundId: "a", volume: 1, muted: false },
      { soundId: "b", volume: 1, muted: false },
    ];
    const result = exportMix(layers, path.join(tmp, "loud.wav"), 1, library());
    if (!("file" in result)) throw new Error(result.error);
    expect(result.gain).toBeLessThan(1); // 0.6+0.6 = 1.2 peak → attenuated
  });

  it("skips muted layers and errors when nothing is audible", () => {
    const layers: Layer[] = [{ soundId: "a", volume: 0.5, muted: true }];
    const result = exportMix(layers, path.join(tmp, "x.wav"), 1, library());
    expect("error" in result).toBe(true);
  });

  it("rejects non-WAV sources with a helpful message", () => {
    const layers: Layer[] = [{ soundId: "mp3", volume: 0.5, muted: false }];
    const result = exportMix(layers, path.join(tmp, "x.wav"), 1, library());
    expect("error" in result && result.error).toContain("only .wav");
  });
});
