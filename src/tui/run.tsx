import { render } from "ink";
import { detectBackend } from "../audio/backend.js";
import { Mixer } from "../audio/mixer.js";
import { loadLibrary } from "../library.js";
import type { Layer } from "../types.js";
import { App } from "./App.js";

/** Launch the interactive mixer, optionally seeded with preset layers. */
export async function runApp(
  initialLayers: Layer[] = [],
  presetName?: string,
): Promise<void> {
  const backend = detectBackend();
  const library = loadLibrary();
  const mixer = new Mixer(backend, library);
  if (initialLayers.length > 0) mixer.loadLayers(initialLayers);

  const { waitUntilExit } = render(
    <App
      mixer={mixer}
      library={library}
      backend={backend}
      presetName={presetName}
    />,
  );
  await waitUntilExit();
  mixer.stopAll();
}
