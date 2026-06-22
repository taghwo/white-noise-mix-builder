import { Box, Text, useApp, useInput } from "ink";
import React, { useState } from "react";
import { type Backend, silentFallbackHint } from "../audio/backend.js";
import type { Mixer } from "../audio/mixer.js";
import { listPresets, savePreset } from "../presets.js";
import type { Layer, Preset, Sound } from "../types.js";
import { AddPicker, type PickItem } from "./AddPicker.js";
import { Slider } from "./Slider.js";
import { StatusBar } from "./StatusBar.js";

const VOLUME_STEP = 0.05;

export interface AppProps {
  mixer: Mixer;
  library: Sound[];
  backend: Backend;
  /** Name of a preset that seeded the mix, shown in the header. */
  presetName?: string;
}

type Mode = "mix" | "picker" | "save";

const MIX_HINTS =
  "↑/↓ select · ←/→ volume · space mute · a add/load · x remove · [ ] master · s save · q quit";

export function App({
  mixer,
  library,
  backend,
  presetName,
}: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [layers, setLayers] = useState<Layer[]>(() => mixer.getLayers());
  const [master, setMaster] = useState<number>(() => mixer.masterVolume);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>("mix");
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState("");
  const [saveName, setSaveName] = useState(presetName ?? "");
  const [activeName, setActiveName] = useState(presetName);
  const [pickItems, setPickItems] = useState<PickItem[]>([]);

  const sync = () => setLayers(mixer.getLayers());

  const byId = (id: string): Sound | undefined =>
    library.find((s: Sound) => s.id === id);

  const quit = () => {
    mixer.stopAll();
    exit();
  };

  useInput((input, key) => {
    if (mode === "save") {
      if (key.escape) {
        setMode("mix");
        return;
      }
      if (key.return) {
        const name = saveName.trim();
        if (name) {
          savePreset(name, mixer.getLayers());
          setActiveName(name);
          setMessage(`Saved "${name}"`);
        }
        setMode("mix");
        return;
      }
      if (key.backspace || key.delete) {
        setSaveName((n) => n.slice(0, -1));
        return;
      }
      // Append printable characters (ignore control keys).
      if (input && !key.ctrl && !key.meta) setSaveName((n) => n + input);
      return;
    }

    if (mode === "picker") {
      if (key.escape) {
        setMode("mix");
        return;
      }
      if (key.upArrow) setCursor((c) => Math.max(0, c - 1));
      else if (key.downArrow)
        setCursor((c) => Math.min(pickItems.length - 1, c + 1));
      else if (key.return) {
        const item = pickItems[cursor];
        if (!item) return;
        if (item.kind === "sound") {
          const added = !mixer.has(item.sound.id);
          mixer.addLayer(item.sound.id, 0.6);
          sync();
          setSelected(
            mixer
              .getLayers()
              .findIndex((l: Layer) => l.soundId === item.sound.id),
          );
          setMessage(
            added ? `Added ${item.sound.label}` : `${item.sound.label} already in mix`,
          );
        } else {
          mixer.loadLayers(item.preset.layers);
          sync();
          setMaster(mixer.masterVolume);
          setSelected(0);
          setActiveName(item.preset.name);
          setMessage(`Loaded "${item.preset.name}"`);
        }
        setMode("mix");
      }
      return;
    }

    // mix mode
    if (input === "q" || key.escape) return quit();

    if (input === "a" || input === "+") {
      const items: PickItem[] = [
        ...library.map((sound: Sound): PickItem => ({ kind: "sound", sound })),
        ...listPresets().map(
          (preset: Preset): PickItem => ({ kind: "preset", preset }),
        ),
      ];
      setPickItems(items);
      setCursor(0);
      setMode("picker");
      return;
    }

    if (input === "s" && layers.length > 0) {
      setSaveName(activeName ?? "");
      setMode("save");
      return;
    }

    if (input === "[" || input === "]") {
      mixer.setMaster(master + (input === "]" ? VOLUME_STEP : -VOLUME_STEP));
      setMaster(mixer.masterVolume);
      return;
    }

    if (layers.length === 0) return;
    const current = layers[Math.min(selected, layers.length - 1)];
    if (!current) return;

    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    else if (key.downArrow)
      setSelected((s) => Math.min(layers.length - 1, s + 1));
    else if (key.leftArrow) {
      mixer.adjustVolume(current.soundId, -VOLUME_STEP);
      sync();
    } else if (key.rightArrow) {
      mixer.adjustVolume(current.soundId, VOLUME_STEP);
      sync();
    } else if (input === " ") {
      mixer.toggleMute(current.soundId);
      sync();
    } else if (input === "x") {
      mixer.removeLayer(current.soundId);
      sync();
      setSelected((s) => Math.max(0, Math.min(s, mixer.getLayers().length - 1)));
      setMessage(`Removed ${byId(current.soundId)?.label ?? current.soundId}`);
    }
  });

  const title = activeName ? `🎧 ${activeName}` : "🎧 white-noise-mix-builder";

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>{title}</Text>
      <Box marginTop={1} flexDirection="column">
        {layers.length === 0 ? (
          <Text dimColor>No layers yet — press "a" to add a sound.</Text>
        ) : (
          layers.map((layer: Layer, i: number) => {
            const sound = byId(layer.soundId);
            return (
              <Slider
                key={layer.soundId}
                label={sound?.label ?? layer.soundId}
                icon={sound?.icon}
                volume={layer.volume}
                muted={layer.muted}
                selected={i === selected}
              />
            );
          })
        )}
      </Box>

      {mode === "picker" ? (
        <Box marginTop={1}>
          <AddPicker
            items={pickItems}
            cursor={cursor}
            active={new Set(layers.map((l: Layer) => l.soundId))}
          />
        </Box>
      ) : mode === "save" ? (
        <Box marginTop={1} borderStyle="round" paddingX={1}>
          <Text>
            Save as: <Text color="cyan">{saveName}</Text>
            <Text inverse> </Text>
            <Text dimColor>  (enter to save · esc to cancel)</Text>
          </Text>
        </Box>
      ) : (
        <StatusBar
          backend={backend.name}
          silent={backend.silent}
          master={master}
          hint={message ? `${message}   ${MIX_HINTS}` : MIX_HINTS}
          silentReason={silentFallbackHint()}
        />
      )}
    </Box>
  );
}
