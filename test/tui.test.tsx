import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render } from "ink-testing-library";
import React from "react";
import { describe, expect, it } from "vitest";
import { silentBackend } from "../src/audio/backend.js";
import { Mixer } from "../src/audio/mixer.js";
import { listPresets, savePreset } from "../src/presets.js";
import { App } from "../src/tui/App.js";
import type { Preset, Sound } from "../src/types.js";

const library: Sound[] = [
  { id: "rain", label: "Rain", icon: "🌧️", file: "/fake/rain.wav" },
  { id: "fire", label: "Fire", icon: "🔥", file: "/fake/fire.wav" },
];

const KEY = {
  up: "[A",
  down: "[B",
  left: "[D",
  right: "[C",
  enter: "\r",
  esc: "",
};

const tick = () => new Promise((r) => setTimeout(r, 40));

async function setup(withLayer = true) {
  const mixer = new Mixer(silentBackend, library);
  if (withLayer) mixer.addLayer("rain", 0.5);
  const app = render(
    <App mixer={mixer} library={library} backend={silentBackend} />,
  );
  await tick(); // let the component mount and subscribe to input
  return app;
}

describe("App", () => {
  it("renders a slider for an existing layer", async () => {
    const { lastFrame } = await setup();
    expect(lastFrame()).toContain("Rain");
    expect(lastFrame()).toContain("50%");
    expect(lastFrame()).toContain("silent");
  });

  it("shows an empty hint when there are no layers", async () => {
    const { lastFrame } = await setup(false);
    expect(lastFrame()).toContain("No layers yet");
  });

  it("adjusts volume with the right arrow", async () => {
    const { stdin, lastFrame } = await setup();
    stdin.write(KEY.right);
    await tick();
    expect(lastFrame()).toContain("55%");
  });

  it("mutes with space", async () => {
    const { stdin, lastFrame } = await setup();
    stdin.write(" ");
    await tick();
    expect(lastFrame()).toContain("(muted)");
  });

  it("opens the library picker with 'a' and adds with enter", async () => {
    const { stdin, lastFrame } = await setup(false);
    stdin.write("a");
    await tick();
    expect(lastFrame()).toContain("Add a sound");

    stdin.write(KEY.down); // move to Fire
    await tick();
    stdin.write(KEY.enter);
    await tick();
    expect(lastFrame()).toContain("Fire");
    expect(lastFrame()).not.toContain("Add a sound");
  });

  it("adjusts master volume with brackets", async () => {
    const { stdin, lastFrame } = await setup();
    expect(lastFrame()).toContain("master");
    stdin.write("[");
    await tick();
    expect(lastFrame()).toContain("95%");
  });

  it("loads a preset from the 'a' picker", async () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "wnm-load-"));
    process.env.WNM_HOME = tmpHome;
    try {
      savePreset("night", [{ soundId: "rain", volume: 0.3, muted: false }]);
      // Start with an empty mix (no layers), then load via the picker.
      const { stdin, lastFrame } = await setup(false);
      stdin.write("a");
      await tick();
      expect(lastFrame()).toContain("Presets");
      expect(lastFrame()).toContain("night");
      // Items are: rain, fire, then the "night" preset → 2 downs to reach it.
      stdin.write(KEY.down);
      await tick();
      stdin.write(KEY.down);
      await tick();
      stdin.write(KEY.enter);
      await tick();
      expect(lastFrame()).toContain("Loaded");
      expect(lastFrame()).toContain("Rain"); // the preset's layer is now playing
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
      delete process.env.WNM_HOME;
    }
  });

  it("saves a preset via the 's' flow", async () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "wnm-tui-"));
    process.env.WNM_HOME = tmpHome;
    try {
      const { stdin, lastFrame } = await setup();
      stdin.write("s");
      await tick();
      expect(lastFrame()).toContain("Save as:");
      for (const ch of "calm") stdin.write(ch);
      await tick();
      expect(lastFrame()).toContain("calm");
      stdin.write("\r");
      await tick();
      expect(listPresets().map((p: Preset) => p.name)).toContain("calm");
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
      delete process.env.WNM_HOME;
    }
  });
});
