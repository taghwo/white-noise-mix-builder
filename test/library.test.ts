import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const cliPath = path.resolve(__dirname, "..", "src", "cli.ts");

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "wnm-test-"));
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function runCli(args: string[]): string {
  return execFileSync("npx", ["tsx", cliPath, ...args], {
    env: { ...process.env, WNM_HOME: tmpHome },
    encoding: "utf8",
  });
}

describe("library via CLI", () => {
  it("lists the three bundled noise sounds", () => {
    const out = runCli(["list"]);
    expect(out).toContain("white-noise");
    expect(out).toContain("pink-noise");
    expect(out).toContain("brown-noise");
    expect(out).toContain("bundled");
  });

  it("discovers loose user sounds dropped into WNM_HOME/sounds", () => {
    const soundsDir = path.join(tmpHome, "sounds");
    fs.mkdirSync(soundsDir, { recursive: true });
    fs.writeFileSync(path.join(soundsDir, "ocean_waves.wav"), "stub");

    const out = runCli(["list"]);
    expect(out).toContain("ocean_waves");
    expect(out).toContain("Ocean Waves");
    expect(out).toContain("user");
  });
});
