import { readFileSync, writeFileSync } from "node:fs";
import { parseTrace, replayTrace } from "../src/control-recording";
const [input, output] = process.argv.slice(2);
if (!input)
  throw new Error("Usage: npm run replay -- recording.json [output.json]");
const frames = replayTrace(parseTrace(JSON.parse(readFileSync(input, "utf8"))));
const summary = {
  frames: frames.length,
  enabledSamples: frames.reduce(
    (n, f) => n + f.hands.filter((h) => h.enabled).length,
    0,
  ),
  duplicateAssignments: frames.filter(
    (f) => new Set(f.hands.map((h) => h.side)).size !== f.hands.length,
  ).length,
};
if (output) writeFileSync(output, JSON.stringify(frames, null, 2));
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
