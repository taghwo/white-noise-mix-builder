import fs from "node:fs";

/** Decoded mono audio: float samples in [-1, 1] plus the sample rate. */
export interface DecodedWav {
  sampleRate: number;
  /** Mono samples (stereo inputs are downmixed). */
  samples: Float32Array;
}

interface ChunkInfo {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
}

function findChunks(buf: Buffer): ChunkInfo {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a RIFF/WAVE file");
  }
  let offset = 12;
  let fmt: Omit<ChunkInfo, "dataOffset" | "dataSize"> | undefined;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      dataOffset = body;
      dataSize = Math.min(size, buf.length - body);
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }

  if (!fmt || dataOffset < 0) throw new Error("Missing fmt or data chunk");
  return { ...fmt, dataOffset, dataSize };
}

/** Read a 16-bit PCM WAV file into mono float samples. */
export function decodeWav(file: string): DecodedWav {
  const buf = fs.readFileSync(file);
  const info = findChunks(buf);
  if (info.audioFormat !== 1 || info.bitsPerSample !== 16) {
    throw new Error("Only 16-bit PCM WAV files are supported");
  }
  const { channels, sampleRate, dataOffset, dataSize } = info;
  const frames = Math.floor(dataSize / 2 / channels);
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      sum += buf.readInt16LE(dataOffset + (i * channels + c) * 2) / 32768;
    }
    samples[i] = sum / channels; // downmix to mono
  }
  return { sampleRate, samples };
}

/** Write mono float samples to a 16-bit PCM WAV file. */
export function encodeWav(file: string, samples: Float32Array, sampleRate: number): void {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}
