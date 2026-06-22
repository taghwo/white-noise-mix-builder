import fs from "node:fs";
import path from "node:path";
import {
  bundledSoundsDir,
  supportedExtensions,
  userSoundsDir,
} from "./config.js";
import type { ManifestEntry, Sound } from "./types.js";

function readManifest(dir: string): ManifestEntry[] {
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as { sounds?: ManifestEntry[] };
    return Array.isArray(parsed.sounds) ? parsed.sounds : [];
  } catch {
    return [];
  }
}

/** Turn "deep-rain_loop.wav" into "Deep Rain Loop". */
function titleCaseFromFilename(file: string): string {
  const base = path.basename(file, path.extname(file));
  return base
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isSupported(file: string): boolean {
  return supportedExtensions.includes(path.extname(file).toLowerCase());
}

function loadFromManifest(dir: string, user: boolean): Sound[] {
  return readManifest(dir)
    .map((entry: ManifestEntry): Sound | null => {
      const file = path.isAbsolute(entry.file)
        ? entry.file
        : path.join(dir, entry.file);
      if (!fs.existsSync(file)) return null;
      return {
        id: entry.id,
        label: entry.label,
        file,
        icon: entry.icon,
        license: entry.license,
        attribution: entry.attribution,
        user,
      };
    })
    .filter((s: Sound | null): s is Sound => s !== null);
}

/** Discover loose audio files not listed in a manifest. */
function loadLooseFiles(dir: string, taken: Set<string>, user: boolean): Sound[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(isSupported)
    .map((name: string): Sound => {
      const file = path.join(dir, name);
      const id = path.basename(name, path.extname(name)).toLowerCase();
      return { id, label: titleCaseFromFilename(name), file, user };
    })
    .filter((s: Sound) => !taken.has(s.id));
}

/**
 * Build the full sound library: bundled sounds first, then user sounds.
 * User sounds with a duplicate id override bundled ones.
 */
export function loadLibrary(): Sound[] {
  const byId = new Map<string, Sound>();

  const add = (sounds: Sound[]) => {
    for (const sound of sounds) byId.set(sound.id, sound);
  };

  const bundledManifest = loadFromManifest(bundledSoundsDir, false);
  add(bundledManifest);
  add(
    loadLooseFiles(
      bundledSoundsDir,
      new Set(bundledManifest.map((s: Sound) => s.id)),
      false,
    ),
  );

  const userManifest = loadFromManifest(userSoundsDir, true);
  add(userManifest);
  add(
    loadLooseFiles(
      userSoundsDir,
      new Set(userManifest.map((s: Sound) => s.id)),
      true,
    ),
  );

  return [...byId.values()].sort((a: Sound, b: Sound) =>
    a.label.localeCompare(b.label),
  );
}

export function findSound(id: string, library = loadLibrary()): Sound | undefined {
  return library.find((s: Sound) => s.id === id);
}
