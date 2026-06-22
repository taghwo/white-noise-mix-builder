import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Layer, Preset } from "../src/types.js";
// presets resolves WNM_HOME lazily per call, so a normal import is fine.
import * as presets from "../src/presets.js";

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "wnm-preset-"));
  process.env.WNM_HOME = tmpHome;
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  delete process.env.WNM_HOME;
});

const layers: Layer[] = [
  { soundId: "rain", volume: 0.5, muted: false },
  { soundId: "fire", volume: 0.8, muted: true },
];

describe("presets", () => {
  it("slugifies names for filenames", () => {
    expect(presets.slugify("Focus Deep!")).toBe("focus-deep");
    expect(presets.slugify("  Rainy   Night  ")).toBe("rainy-night");
  });

  it("saves and loads a preset round-trip", () => {
    presets.savePreset("Focus Deep", layers);
    const loaded = presets.loadPreset("Focus Deep");
    expect(loaded?.name).toBe("Focus Deep");
    expect(loaded?.layers).toHaveLength(2);
    expect(loaded?.layers[1]?.muted).toBe(true);
  });

  it("returns undefined for a missing preset", () => {
    expect(presets.loadPreset("nope")).toBeUndefined();
    expect(presets.presetExists("nope")).toBe(false);
  });

  it("overwrites a preset with the same slug", () => {
    presets.savePreset("Mix", [layers[0]!]);
    presets.savePreset("mix", layers);
    expect(presets.listPresets()).toHaveLength(1);
    expect(presets.loadPreset("Mix")?.layers).toHaveLength(2);
  });

  it("lists and deletes presets", () => {
    presets.savePreset("A", layers);
    presets.savePreset("B", layers);
    expect(
      presets
        .listPresets()
        .map((p: Preset) => p.name)
        .sort(),
    ).toEqual(["A", "B"]);
    expect(presets.deletePreset("A")).toBe(true);
    expect(presets.deletePreset("A")).toBe(false);
    expect(presets.listPresets()).toHaveLength(1);
  });

  it("ignores malformed layers when loading", () => {
    const file = path.join(tmpHome, "presets", "bad.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({
        name: "bad",
        layers: [{ soundId: "rain", volume: 0.5, muted: false }, { nope: 1 }],
      }),
    );
    expect(presets.loadPreset("bad")?.layers).toHaveLength(1);
  });
});
