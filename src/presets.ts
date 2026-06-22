import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Layer, Preset } from "./types.js";

/**
 * Resolved fresh each call so a changed WNM_HOME (e.g. in tests) is honored
 * rather than frozen at import time.
 */
function presetsDirPath(): string {
  const home =
    process.env.WNM_HOME ?? path.join(os.homedir(), ".white-noise-mix");
  return path.join(home, "presets");
}

/** Turn a display name into a safe filename slug. */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function presetPath(name: string): string {
  return path.join(presetsDirPath(), `${slugify(name)}.json`);
}

function isLayer(value: unknown): value is Layer {
  if (typeof value !== "object" || value === null) return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.soundId === "string" &&
    typeof l.volume === "number" &&
    typeof l.muted === "boolean"
  );
}

/** Persist a mix under `name`, overwriting any existing preset with that slug. */
export function savePreset(name: string, layers: Layer[]): Preset {
  fs.mkdirSync(presetsDirPath(), { recursive: true });
  const preset: Preset = {
    name: name.trim(),
    layers: layers.map((l: Layer) => ({ ...l })),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(presetPath(name), JSON.stringify(preset, null, 2));
  return preset;
}

/** Load a preset by name, or undefined if it doesn't exist / is invalid. */
export function loadPreset(name: string): Preset | undefined {
  const file = presetPath(name);
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const p = parsed as Record<string, unknown>;
    if (!Array.isArray(p.layers)) return undefined;
    const layers = p.layers.filter(isLayer);
    return {
      name: typeof p.name === "string" ? p.name : name,
      layers,
      updatedAt:
        typeof p.updatedAt === "string" ? p.updatedAt : new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

/** List all saved presets, newest first. */
export function listPresets(): Preset[] {
  if (!fs.existsSync(presetsDirPath())) return [];
  return fs
    .readdirSync(presetsDirPath())
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) => loadPreset(path.basename(f, ".json")))
    .filter((p: Preset | undefined): p is Preset => p !== undefined)
    .sort((a: Preset, b: Preset) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Delete a preset. Returns true if a file was removed. */
export function deletePreset(name: string): boolean {
  const file = presetPath(name);
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  return true;
}

export function presetExists(name: string): boolean {
  return fs.existsSync(presetPath(name));
}
