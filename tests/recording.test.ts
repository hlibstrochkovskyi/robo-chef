import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TraceRecorder,
  parseTrace,
  replayTrace,
} from "../src/control-recording";
import { detection, pinch } from "./fixtures/hands";
test("recordings replay calibration, duplicate labels, gestures, and missing frames deterministically", () => {
  const recorder = new TraceRecorder();
  recorder.start(5000);
  for (let time = 5000; time <= 5800; time += 50)
    recorder.frame({
      time,
      detections: [detection("Left"), detection("Right")],
    });
  recorder.calibrate(5825);
  for (let time = 5850; time <= 6100; time += 50)
    recorder.frame({
      time,
      detections: [detection("Left"), detection("Right")],
    });
  const right = pinch(detection("Right", 0.28));
  right.label = "Left";
  for (let time = 6150; time <= 6450; time += 50)
    recorder.frame({ time, detections: [right, detection("Left")] });
  recorder.frame({ time: 6500, detections: [] });
  const trace = recorder.stop(),
    first = replayTrace(trace),
    second = replayTrace(trace);
  assert.deepEqual(first, second);
  assert.ok(first.some((f) => f.hands.some((h) => h.enabled && h.grip)));
  assert.ok(
    first.every(
      (f) => new Set(f.hands.map((h) => h.side)).size === f.hands.length,
    ),
  );
  const corrupt = structuredClone(trace);
  corrupt.events[1] = { type: "calibrate", time: -1 };
  assert.throws(() => parseTrace(corrupt));
});
