// Generates seamless-looping noise WAV files into assets/sounds/.
// These are synthesized, so they carry no licensing constraints (CC0).
// Run with: node scripts/gen-noise.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "..", "assets", "sounds");
fs.mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 44100;
const SECONDS = 8; // short loop; players repeat it

function writeWav(filename, samples) {
  const numSamples = samples.length;
  const blockAlign = 2; // mono, 16-bit
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * blockAlign);
  }
  fs.writeFileSync(path.join(outDir, filename), buf);
}

// Cross-fade the buffer with a shifted copy of itself so the loop is seamless.
function makeSeamless(samples) {
  const n = samples.length;
  const fade = Math.floor(SAMPLE_RATE * 0.25);
  const out = samples.slice(0, n - fade);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = samples[i] * t + samples[n - fade + i] * (1 - t);
  }
  return out;
}

function white(n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.random() * 2 - 1) * 0.6;
  return out;
}

function pink(n) {
  // Paul Kellet's economy pink-noise filter.
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

function brown(n) {
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    out[i] = last * 3.5;
  }
  return out;
}

const n = SAMPLE_RATE * SECONDS;
// Lazy generators so we only synthesize the loops we actually need to write.
const variants = [
  ["white-noise.wav", () => white(n)],
  ["pink-noise.wav", () => pink(n)],
  ["brown-noise.wav", () => brown(n)],
];

// By default, only create loops that are missing (idempotent — safe to run on
// every `npm install`/`setup`). Pass --force to regenerate them all.
const force = process.argv.includes("--force");

for (const [name, generate] of variants) {
  const dest = path.join(outDir, name);
  if (!force && fs.existsSync(dest)) {
    console.log("exists, skipping", name);
    continue;
  }
  writeWav(name, makeSeamless(generate()));
  console.log("wrote", name);
}
