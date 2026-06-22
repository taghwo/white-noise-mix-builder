import { Box, Text } from "ink";
import React from "react";

const BAR_WIDTH = 24;

export interface SliderProps {
  label: string;
  icon?: string;
  /** 0..1 */
  volume: number;
  muted: boolean;
  selected: boolean;
}

/** Build the "▕███████░░░░░▏" bar for a given fraction. */
function bar(fraction: number): string {
  const filled = Math.round(fraction * BAR_WIDTH);
  return "▕" + "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled) + "▏";
}

/** A single labelled volume row. */
export function Slider({
  label,
  icon,
  volume,
  muted,
  selected,
}: SliderProps): React.ReactElement {
  const pct = `${Math.round(volume * 100)}%`.padStart(4);
  const name = `${icon ? `${icon} ` : ""}${label}`.padEnd(16);
  const pointer = selected ? "›" : " ";
  const color = muted ? "gray" : selected ? "cyan" : undefined;

  return (
    <Box>
      <Text color={selected ? "cyan" : undefined} bold={selected}>
        {pointer}{" "}
      </Text>
      <Text color={color} dimColor={muted}>
        {name}
        {bar(muted ? 0 : volume)} {pct}
        {muted ? "  (muted)" : ""}
      </Text>
    </Box>
  );
}
