# white-noise-mix-builder 🎧

Build custom white-noise mixes from a library of environmental sounds, with
live volume sliders right in your terminal. Layer rain over a cafe over brown
noise, dial in each level, save the combo, and play it back any time.

> **Status:** all core features are working — interactive mixer, multi-layer
> playback, presets (save/load), and WAV export. See the [roadmap](#roadmap).

## Why

Finding the right ambient mix for focus or sleep usually means juggling several
apps and a lot of trial and error. `wnm` puts a simple, scriptable mixer in the
one place you already live — the command line.

## Install (dev)

```bash
npm install     # also builds and synthesizes the bundled noise loops
npm run setup   # builds, generates sounds, and links the `wnm` command
```

`npm run setup` puts the `wnm` command on your PATH (via `npm link`). Open a
new terminal afterwards (or run `hash -r`) so your shell finds it. To remove it
later, run `npm run unlink`.

The bundled white/pink/brown noise loops are generated, not committed, so they
are created on first install. Generation is idempotent — it only writes loops
that are missing. Run `npm run gen-sounds -- --force` to regenerate them.

Prefer not to link? After `npm install` you can run it locally instead:

```bash
npm start -- list            # same as `wnm list`
node dist/cli.js list
```

During development you can also run straight from TypeScript (no build step)
with `tsx`:

```bash
npm run dev -- list          # runs src/cli.ts directly
```

## Usage

```bash
wnm                          # launch the interactive mixer
wnm list                     # show every available sound
wnm play rain                # play one sound on a loop (headless)
wnm mix rain=0.5 fire=0.8    # play several sounds at once (headless)
wnm save calm rain=0.5 fire  # save a preset from the CLI
wnm presets                  # list saved presets
wnm load calm                # open the mixer seeded from a preset
wnm play calm                # play a preset (or a single sound) headless
wnm export calm calm.wav     # render a preset to a single WAV file
wnm rm calm                  # delete a preset
wnm help                     # show built-in usage
```

### Command reference

| Command | What it does |
| ------- | ------------ |
| `wnm` | Launch the interactive mixer (needs a real terminal/TTY). |
| `wnm list` | List every available sound (bundled + your own), with its id. |
| `wnm play <id\|preset> [opts]` | Play a single sound **or** a saved preset on a loop, no UI. If the name matches a preset it plays the whole mix; otherwise it plays that one sound. |
| `wnm mix <id>[=vol] ... [opts]` | Play several sounds layered together, no UI. |
| `wnm save <name> <id>[=vol] ...` | Save a preset from the command line. |
| `wnm presets` | List saved presets and their layers. |
| `wnm load <preset>` | Open the interactive mixer seeded with a preset. |
| `wnm export <preset> [out.wav] [opts]` | Render a preset to a single WAV file. |
| `wnm rm <preset>` | Delete a saved preset. |
| `wnm help` | Print usage. |

### The `id=vol` syntax

`mix` and `save` take a list of sounds, each optionally with a volume after an
`=` sign (a number from `0` to `1`). Omit it and the layer defaults to `0.6`:

```bash
wnm mix rain=0.5 fire=0.8 wind     # rain at 50%, fire at 80%, wind at 60%
wnm save sleepy brown-noise=0.7    # one-layer preset at 70%
```

Use `wnm list` to see the exact ids (e.g. `white-noise`, `brown-noise`).

### Options (flags)

| Flag | Applies to | Default | Meaning |
| ---- | ---------- | ------- | ------- |
| `--volume <0..1>` | `play <id>` (single sound only) | `0.8` | Playback volume for that one sound. |
| `--seconds <n>` | `play`, `mix` | until `Ctrl-C` | Stop automatically after *n* seconds. |
| `--seconds <n>` | `export` | `60` | Length of the rendered WAV, in seconds. |

```bash
wnm play brown-noise --volume 0.3 --seconds 600   # 10 min of quiet brown noise
wnm mix rain fire --seconds 1800                  # a 30-minute focus session
wnm export calm calm.wav --seconds 120            # render a 2-minute file
```

> Note: `--volume` only applies to playing a **single** sound. For a `mix` or a
> preset, each layer carries its own volume (set via the `id=vol` syntax or the
> interactive sliders).

### Interactive mixer keys

| Key       | Action                        |
| --------- | ----------------------------- |
| `↑` / `↓` | Select a layer                |
| `←` / `→` | Adjust the layer's volume     |
| `space`   | Mute / unmute the layer       |
| `a`       | Add a sound **or** load a preset (grouped picker) |
| `x`       | Remove the selected layer     |
| `[` / `]` | Master volume down / up       |
| `s`       | Save the current mix as a preset |
| `q`       | Quit                          |

Presets are stored as JSON in `~/.white-noise-mix/presets/`.

## Exporting

`wnm export <preset> [out.wav] [--seconds n]` renders a saved mix down to one
WAV file (default 60s). The renderer is pure Node — it loops each layer, scales
by its volume, sums them, and applies just enough gain reduction to avoid
clipping — so **no ffmpeg or sox is required**. Sources must be 16-bit PCM WAV
(the bundled sounds already are).

## Sounds

The bundled library ships three synthesized, CC0 noise loops: **white**,
**pink**, and **brown** noise. Add your own by dropping `.wav`/`.mp3`/`.ogg`
(and friends) files into:

```
~/.white-noise-mix/sounds/
```

They are auto-discovered and named from their filename. A custom sound with the
same id as a bundled one overrides it.

## Environment variables

| Variable | Values | What it does |
| -------- | ------ | ------------ |
| `WNM_HOME` | a directory path | Where presets and your custom sounds live. Defaults to `~/.white-noise-mix`. Handy for keeping separate sound sets, or for testing. |
| `WNM_BACKEND` | `ffplay` · `sox` · `afplay` · `silent` | Force a specific audio engine instead of auto-detecting. `silent` runs the app with **no audio** (useful for scripting or CI). An unknown value is ignored and normal detection runs. |

```bash
WNM_BACKEND=silent wnm mix rain fire     # exercise the mixer with no sound
WNM_HOME=~/work-sounds wnm list          # use a separate library + presets
```

You can set these inline (as above) or put them in a **`.env`** file, which the
CLI loads automatically on startup from the directory you run it in. Copy the
template to get started:

```bash
cp .env.example .env
```

Inline/real environment variables take precedence over `.env`.

If no audio player is found at all, `wnm` still runs but prints a note
explaining that the mix is silent and which players you can install
(`ffmpeg`/`ffplay`, `sox`, or — on macOS — the built-in `afplay`).

## Where your data lives

Everything personal lives under one folder (`~/.white-noise-mix` by default, or
`$WNM_HOME`):

```
~/.white-noise-mix/
├── sounds/     # drop your own audio files here (auto-discovered)
└── presets/    # saved mixes, one <name>.json per preset
```

Presets are plain JSON, so they're easy to inspect, edit, back up, or share —
each one just lists the sounds and their volumes.

## Roadmap

1. ✅ Scaffold + sound library + `list`
2. ✅ Audio backend (ffplay → sox → afplay → silent fallback) + `play`
3. ✅ Multi-layer mixer with independent volume + `mix`
4. ✅ Interactive Ink UI with sliders
5. ✅ Save / load / `play <preset>`
6. ✅ Export a mix to a single WAV (pure Node, no ffmpeg needed)
7. Polish: more sounds, docs, CI

## Tech

TypeScript · [Ink](https://github.com/vadimdemedes/ink) · Vitest · zero runtime
audio deps (uses your system's audio tools).

## License

MIT
