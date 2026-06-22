import { Box, Text } from "ink";
import React from "react";

const BAR_WIDTH = 12;

export interface StatusBarProps {
  backend: string;
  silent: boolean;
  master: number;
  hint: string;
  /** Shown when audio is silent because no player is installed. */
  silentReason?: string;
}

export function StatusBar({
  backend,
  silent,
  master,
  hint,
  silentReason,
}: StatusBarProps): React.ReactElement {
  const filled = Math.round(master * BAR_WIDTH);
  const masterBar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text dimColor>backend </Text>
        <Text color={silent ? "yellow" : "green"}>
          {backend}
          {silent ? " (no audio)" : ""}
        </Text>
        <Text dimColor>   master </Text>
        <Text color="magenta">
          {masterBar} {`${Math.round(master * 100)}%`.padStart(4)}
        </Text>
      </Box>
      {silentReason ? <Text color="yellow">⚠ {silentReason}</Text> : null}
      <Text dimColor>{hint}</Text>
    </Box>
  );
}
