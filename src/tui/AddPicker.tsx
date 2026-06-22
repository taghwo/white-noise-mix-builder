import { Box, Text } from "ink";
import React from "react";
import type { Preset, Sound } from "../types.js";

/** A single selectable row in the picker: either a sound or a saved preset. */
export type PickItem =
  | { kind: "sound"; sound: Sound }
  | { kind: "preset"; preset: Preset };

export interface AddPickerProps {
  items: PickItem[];
  /** Index (into `items`) of the highlighted row. */
  cursor: number;
  /** Sound ids already in the mix (shown as added). */
  active: Set<string>;
}

function SoundRow({
  sound,
  selected,
  inMix,
}: {
  sound: Sound;
  selected: boolean;
  inMix: boolean;
}): React.ReactElement {
  return (
    <Text
      color={selected ? "cyan" : inMix ? "gray" : undefined}
      bold={selected}
      dimColor={inMix && !selected}
    >
      {selected ? "› " : "  "}
      {sound.icon ? `${sound.icon} ` : ""}
      {sound.label}
      {inMix ? "  ✓ in mix" : ""}
    </Text>
  );
}

function PresetRow({
  preset,
  selected,
}: {
  preset: Preset;
  selected: boolean;
}): React.ReactElement {
  return (
    <Text color={selected ? "cyan" : undefined} bold={selected}>
      {selected ? "› " : "  "}
      {preset.name}
      <Text dimColor> · {preset.layers.length} layers</Text>
    </Text>
  );
}

/**
 * Overlay for adding to the mix: sounds (add a layer) and saved presets
 * (load the whole mix), shown as two labelled groups.
 */
export function AddPicker({
  items,
  cursor,
  active,
}: AddPickerProps): React.ReactElement {
  const sounds = items.filter((it: PickItem) => it.kind === "sound");
  const presets = items.filter((it: PickItem) => it.kind === "preset");

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={1}>
      <Text bold>Add a sound or load a preset</Text>

      <Text dimColor>Sounds</Text>
      {sounds.map((it: PickItem) => {
        const index = items.indexOf(it);
        return (
          <SoundRow
            key={`s-${(it as { sound: Sound }).sound.id}`}
            sound={(it as { sound: Sound }).sound}
            selected={index === cursor}
            inMix={active.has((it as { sound: Sound }).sound.id)}
          />
        );
      })}

      <Box marginTop={1}>
        <Text dimColor>Presets</Text>
      </Box>
      {presets.length === 0 ? (
        <Text dimColor>  (none saved yet — press "s" to save)</Text>
      ) : (
        presets.map((it: PickItem) => {
          const index = items.indexOf(it);
          return (
            <PresetRow
              key={`p-${(it as { preset: Preset }).preset.name}`}
              preset={(it as { preset: Preset }).preset}
              selected={index === cursor}
            />
          );
        })
      )}

      <Box marginTop={1}>
        <Text dimColor>↑/↓ move · enter choose · esc cancel</Text>
      </Box>
    </Box>
  );
}
