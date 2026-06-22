import { describe, expect, it } from "vitest";
import { silentBackend } from "../src/audio/backend.js";
import { Mixer } from "../src/audio/mixer.js";
import type { Layer, Sound } from "../src/types.js";

const library: Sound[] = [
  { id: "rain", label: "Rain", file: "/fake/rain.wav" },
  { id: "fire", label: "Fire", file: "/fake/fire.wav" },
  { id: "waves", label: "Waves", file: "/fake/waves.wav" },
];

function newMixer(): Mixer {
  return new Mixer(silentBackend, library);
}

describe("Mixer", () => {
  it("adds and removes layers", () => {
    const m = newMixer();
    expect(m.addLayer("rain", 0.7)).toBe(true);
    expect(m.addLayer("fire")).toBe(true);
    expect(m.getLayers().map((l: Layer) => l.soundId)).toEqual(["rain", "fire"]);

    m.removeLayer("rain");
    expect(m.has("rain")).toBe(false);
    expect(m.getLayers()).toHaveLength(1);
  });

  it("rejects unknown sounds", () => {
    const m = newMixer();
    expect(m.addLayer("dragon")).toBe(false);
    expect(m.getLayers()).toHaveLength(0);
  });

  it("clamps and adjusts volume", () => {
    const m = newMixer();
    m.addLayer("rain", 0.5);
    expect(m.adjustVolume("rain", 0.3)).toBeCloseTo(0.8);
    expect(m.adjustVolume("rain", 1)).toBe(1); // clamped at top
    expect(m.adjustVolume("rain", -5)).toBe(0); // clamped at bottom
  });

  it("re-adding a layer updates its volume instead of duplicating", () => {
    const m = newMixer();
    m.addLayer("rain", 0.4);
    m.addLayer("rain", 0.9);
    expect(m.getLayers()).toHaveLength(1);
    expect(m.getLayers()[0]?.volume).toBeCloseTo(0.9);
  });

  it("toggles mute", () => {
    const m = newMixer();
    m.addLayer("fire", 0.6);
    expect(m.toggleMute("fire")).toBe(true);
    expect(m.getLayers()[0]?.muted).toBe(true);
    expect(m.toggleMute("fire")).toBe(false);
    expect(m.getLayers()[0]?.muted).toBe(false);
  });

  it("tracks master volume", () => {
    const m = newMixer();
    m.addLayer("rain");
    m.setMaster(0.5);
    expect(m.masterVolume).toBe(0.5);
    m.setMaster(2);
    expect(m.masterVolume).toBe(1); // clamped
  });

  it("loads a set of layers, preserving mute", () => {
    const m = newMixer();
    m.loadLayers([
      { soundId: "rain", volume: 0.8, muted: false },
      { soundId: "waves", volume: 0.3, muted: true },
    ]);
    const layers = m.getLayers();
    expect(layers).toHaveLength(2);
    expect(layers.find((l: Layer) => l.soundId === "waves")?.muted).toBe(true);
  });

  it("stopAll clears everything", () => {
    const m = newMixer();
    m.addLayer("rain");
    m.addLayer("fire");
    m.stopAll();
    expect(m.getLayers()).toHaveLength(0);
  });

  it("getLayers returns copies, not internal references", () => {
    const m = newMixer();
    m.addLayer("rain", 0.5);
    const snap = m.getLayers();
    snap[0]!.volume = 0.999;
    expect(m.getLayers()[0]?.volume).toBeCloseTo(0.5);
  });
});
