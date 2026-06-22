import { describe, expect, it } from "vitest";
import {
  type Backend,
  detectBackend,
  silentBackend,
} from "../src/audio/backend.js";
import { Player } from "../src/audio/player.js";

describe("detectBackend", () => {
  it("honors a forced backend name", () => {
    expect(detectBackend("silent").name).toBe("silent");
    expect(detectBackend("ffplay").name).toBe("ffplay");
  });

  it("ignores an unknown forced name and auto-detects a real backend", () => {
    const name = detectBackend("nope-not-real").name;
    expect(["ffplay", "sox", "afplay", "silent"]).toContain(name);
  });
});

describe("backend arg building", () => {
  it("clamps volume into 0..1", () => {
    expect(detectBackend("ffplay").buildArgs("x.wav", 5)).toContain(
      "volume=1.000",
    );
    expect(detectBackend("afplay").buildArgs("x.wav", -1)).toEqual([
      "-v",
      "0.000",
      "x.wav",
    ]);
  });
});

describe("Player with silent backend", () => {
  it("tracks play/stop state without spawning", () => {
    const player = new Player(silentBackend, "x.wav", 0.5).start();
    expect(player.playing).toBe(true);
    expect(player.currentVolume).toBe(0.5);
    player.setVolume(0.9);
    expect(player.currentVolume).toBe(0.9);
    player.stop();
    expect(player.playing).toBe(false);
  });
});

describe("Player loop respawn", () => {
  it("respawns a non-native-loop backend until stopped", async () => {
    let spawns = 0;
    // Fake backend: a short-lived command we can count, no audio.
    const counting: Backend = {
      name: "counting",
      nativeLoop: false,
      silent: false,
      command: "node",
      buildArgs: () => {
        spawns++;
        return ["-e", "setTimeout(()=>{}, 20)"];
      },
    };
    const player = new Player(counting, "x.wav", 1).start();
    await new Promise((r) => setTimeout(r, 150));
    player.stop();
    const afterStop = spawns;
    await new Promise((r) => setTimeout(r, 80));
    expect(afterStop).toBeGreaterThan(1); // looped at least once
    expect(spawns).toBe(afterStop); // no respawn after stop
  });
});
