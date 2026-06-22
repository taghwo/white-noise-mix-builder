#!/usr/bin/env node
import { config } from "dotenv";
config({ quiet: true });
import { detectBackend, silentFallbackHint } from "./audio/backend.js";
import { Mixer } from "./audio/mixer.js";
import { Player } from "./audio/player.js";
import { exportMix } from "./export.js";
import { findSound, loadLibrary } from "./library.js";
import {
  deletePreset,
  listPresets,
  loadPreset,
  savePreset,
  slugify,
} from "./presets.js";
import type { Layer, Sound } from "./types.js";

const USAGE = `white-noise-mix-builder (wnm)

Usage:
  wnm                       Launch the interactive mixer
  wnm list                  List all available sounds
  wnm play <id|preset>      Play a sound or saved preset (headless)
  wnm mix <id>[=vol] ...    Play several layers at once (preview)
  wnm load <preset>         Open the mixer seeded from a saved preset
  wnm save <name> <id>=<vol> ...   Save a preset from the command line
  wnm presets               List saved presets
  wnm export <preset> [out.wav]    Render a preset to a single WAV
  wnm rm <preset>           Delete a saved preset
  wnm help                  Show this help

Options:
  --volume <0..1>           play (single sound): volume (default 0.8)
  --seconds <n>             play/mix: stop after n seconds (default: Ctrl-C)
                            export: length of the rendered file (default 60)

Sounds come from the bundled library plus your own files in
~/.white-noise-mix/sounds/ (override WNM_HOME to relocate).
Force a backend with WNM_BACKEND=ffplay|sox|afplay|silent.`;

function formatSound(s: Sound): string {
  const icon = s.icon ? `${s.icon} ` : "";
  const origin = s.user ? "user" : "bundled";
  const license = s.license ? ` · ${s.license}` : "";
  return `  ${s.id.padEnd(14)} ${icon}${s.label} (${origin}${license})`;
}

function cmdList(): void {
  const library = loadLibrary();
  if (library.length === 0) {
    console.log(
      "No sounds found. Run `node scripts/gen-noise.mjs` to create the\n" +
        "bundled noise loops, or drop audio files in ~/.white-noise-mix/sounds/.",
    );
    return;
  }
  console.log(`Available sounds (${library.length}):\n`);
  for (const sound of library) console.log(formatSound(sound));
}

/** Flags that take a following value (e.g. `--seconds 30`). */
const VALUE_FLAGS = new Set(["--volume", "--seconds"]);

interface ParsedArgs {
  positionals: string[];
  options: Map<string, string>;
}

/** Split argv into positional words and `--flag [value]` options. */
function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg.startsWith("--")) {
      options.set(arg, VALUE_FLAGS.has(arg) ? (argv[++i] ?? "") : "");
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

/** Run until Ctrl-C, or stop automatically after `seconds` (when > 0). */
function runUntil(seconds: number, stop: () => void): void {
  const shutdown = () => {
    stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  if (seconds > 0) setTimeout(shutdown, seconds * 1000);
}

/** Print, once, why there's no sound when we fell back to the silent backend. */
function warnIfSilent(): void {
  const hint = silentFallbackHint();
  if (hint) console.error(`⚠ ${hint}`);
}

/** Parse "rain=0.5 fire" specs into layers, warning on unknown sounds. */
function parseSpecs(specs: string[], library: Sound[]): Layer[] {
  const layers: Layer[] = [];
  for (const spec of specs) {
    const [id, vol] = spec.split("=");
    if (!id || !findSound(id, library)) {
      console.error(`Skipping unknown sound: ${spec}`);
      continue;
    }
    layers.push({ soundId: id, volume: vol === undefined ? 0.6 : Number(vol), muted: false });
  }
  return layers;
}

/** Start a headless mix from layers and run until Ctrl-C or `seconds`. */
function runHeadless(
  layers: Layer[],
  title: string,
  seconds: number,
  library: Sound[],
): void {
  const backend = detectBackend();
  const mixer = new Mixer(backend, library);
  mixer.loadLayers(layers);

  const active = mixer.getLayers();
  if (active.length === 0) {
    console.error("No valid layers to play.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `▶ ${title} — ${active.length} layer(s) via ${backend.name}` +
      `${backend.silent ? " (no audio)" : ""}:`,
  );
  for (const layer of active) {
    const sound = findSound(layer.soundId, library);
    console.log(
      `   ${sound?.icon ?? ""} ${sound?.label ?? layer.soundId} ` +
        `@ ${Math.round(layer.volume * 100)}%${layer.muted ? " (muted)" : ""}`,
    );
  }
  warnIfSilent();
  if (seconds <= 0) console.log("  Press Ctrl-C to stop.");
  runUntil(seconds, () => mixer.stopAll());
}

function cmdPlay(argv: string[]): void {
  const { positionals, options } = parseArgs(argv);
  const name = positionals[0];
  const seconds = Number(options.get("--seconds") ?? "0");
  if (!name) {
    console.error("Usage: wnm play <id|preset> [--volume 0..1] [--seconds n]");
    process.exitCode = 1;
    return;
  }

  const library = loadLibrary();

  // A saved preset takes priority over a same-named sound.
  const preset = loadPreset(name);
  if (preset) {
    runHeadless(preset.layers, preset.name, seconds, library);
    return;
  }

  const sound = findSound(name, library);
  if (!sound) {
    console.error(`No sound or preset named "${name}". Try \`wnm list\`.`);
    process.exitCode = 1;
    return;
  }

  const volume = Number(options.get("--volume") ?? "0.8");
  const backend = detectBackend();
  console.log(
    `▶ ${sound.icon ?? ""} ${sound.label} @ ${Math.round(volume * 100)}% ` +
      `via ${backend.name}${backend.silent ? " (no audio)" : ""}`,
  );
  warnIfSilent();
  if (seconds <= 0) console.log("  Press Ctrl-C to stop.");

  const player = new Player(backend, sound.file, volume).start();
  runUntil(seconds, () => player.stop());
}

function cmdMix(argv: string[]): void {
  const { positionals, options } = parseArgs(argv);
  const seconds = Number(options.get("--seconds") ?? "0");
  if (positionals.length === 0) {
    console.error("Usage: wnm mix <id>[=vol] <id>[=vol] ... [--seconds n]");
    process.exitCode = 1;
    return;
  }
  const library = loadLibrary();
  runHeadless(parseSpecs(positionals, library), "mixing", seconds, library);
}

function cmdSave(argv: string[]): void {
  const [name, ...specs] = parseArgs(argv).positionals;
  if (!name || specs.length === 0) {
    console.error("Usage: wnm save <name> <id>[=vol] <id>[=vol] ...");
    process.exitCode = 1;
    return;
  }
  const layers = parseSpecs(specs, loadLibrary());
  if (layers.length === 0) {
    console.error("No valid sounds to save.");
    process.exitCode = 1;
    return;
  }
  const preset = savePreset(name, layers);
  console.log(`Saved preset "${preset.name}" with ${layers.length} layer(s).`);
}

function cmdPresets(): void {
  const presets = listPresets();
  if (presets.length === 0) {
    console.log("No saved presets yet. Create one with `wnm save`.");
    return;
  }
  console.log(`Saved presets (${presets.length}):\n`);
  for (const p of presets) {
    const ids = p.layers.map((l: Layer) => l.soundId).join(", ");
    console.log(`  ${p.name.padEnd(18)} ${p.layers.length} layers — ${ids}`);
  }
}

function cmdExport(argv: string[]): void {
  const { positionals, options } = parseArgs(argv);
  const name = positionals[0];
  if (!name) {
    console.error("Usage: wnm export <preset> [out.wav] [--seconds n]");
    process.exitCode = 1;
    return;
  }
  const preset = loadPreset(name);
  if (!preset) {
    console.error(`No preset named "${name}". Try \`wnm presets\`.`);
    process.exitCode = 1;
    return;
  }

  const outFile = positionals[1] ?? `${slugify(preset.name)}.wav`;
  const seconds = Number(options.get("--seconds") ?? "60");

  const result = exportMix(preset.layers, outFile, seconds);
  if ("error" in result) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }
  const gainNote =
    result.gain < 1 ? ` (gain −${Math.round((1 - result.gain) * 100)}% to avoid clipping)` : "";
  console.log(
    `Exported "${preset.name}" → ${result.file}\n` +
      `  ${result.layers} layer(s), ${result.seconds}s @ ${result.sampleRate} Hz${gainNote}`,
  );
}

function cmdRm(argv: string[]): void {
  const name = argv[0];
  if (!name) {
    console.error("Usage: wnm rm <preset>");
    process.exitCode = 1;
    return;
  }
  if (deletePreset(name)) console.log(`Deleted preset "${name}".`);
  else {
    console.error(`No preset named "${name}".`);
    process.exitCode = 1;
  }
}

async function launchInteractive(
  layers: Layer[] = [],
  presetName?: string,
): Promise<void> {
  if (!process.stdout.isTTY) {
    console.log("The interactive mixer needs a TTY. Try `wnm list`.\n");
    console.log(USAGE);
    return;
  }
  // Loaded lazily so non-interactive commands don't pull in Ink/React.
  const { runApp } = await import("./tui/run.js");
  await runApp(layers, presetName);
}

function cmdLoad(argv: string[]): void {
  const name = argv[0];
  if (!name) {
    console.error("Usage: wnm load <preset>");
    process.exitCode = 1;
    return;
  }
  const preset = loadPreset(name);
  if (!preset) {
    console.error(`No preset named "${name}". Try \`wnm presets\`.`);
    process.exitCode = 1;
    return;
  }
  void launchInteractive(preset.layers, preset.name);
}

function main(argv: string[]): void {
  const command = argv[0] ?? "";
  switch (command) {
    case "":
      void launchInteractive();
      break;
    case "list":
    case "ls":
      cmdList();
      break;
    case "play":
      cmdPlay(argv.slice(1));
      break;
    case "mix":
      cmdMix(argv.slice(1));
      break;
    case "load":
    case "open":
      cmdLoad(argv.slice(1));
      break;
    case "save":
      cmdSave(argv.slice(1));
      break;
    case "presets":
      cmdPresets();
      break;
    case "export":
      cmdExport(argv.slice(1));
      break;
    case "rm":
    case "delete":
      cmdRm(argv.slice(1));
      break;
    case "help":
    case "-h":
    case "--help":
      console.log(USAGE);
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(USAGE);
      process.exitCode = 1;
  }
}

main(process.argv.slice(2));
