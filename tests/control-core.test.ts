import { test } from "node:test";
import assert from "node:assert/strict";
import { ControlCore, type Detection, gesture } from "../src/control-core";
import { detection, pinch } from "./fixtures/hands";
function ready() {
  const core = new ControlCore();
  for (let time = 0; time <= 800; time += 50)
    core.process({ time, detections: [detection("Left"), detection("Right")] });
  assert.equal(core.calibrate(), 2);
  for (let time = 850; time <= 1100; time += 50)
    core.process({ time, detections: [detection("Left"), detection("Right")] });
  return core;
}
test("duplicate handedness labels and reversed detector order keep unique physical identities", () => {
  const core = ready();
  const left = detection("Left"),
    right = detection("Right");
  right.label = "Left";
  for (let time = 1150; time <= 1400; time += 50) {
    const hands = core.process({
      time,
      detections: time % 100 ? [right, left] : [left, right],
    });
    assert.equal(hands.length, 2);
    assert.equal(new Set(hands.map((h) => h.side)).size, 2);
    assert.ok(hands.find((h) => h.side === "Left")!.landmarks[0].x > 0.5);
    assert.ok(hands.find((h) => h.side === "Right")!.landmarks[0].x < 0.5);
  }
});
test("screen horizontal motion mirrors once; raising a hand raises height without changing reach", () => {
  const core = ready();
  let hands = [] as ReturnType<ControlCore["process"]>;
  for (let time = 1150; time <= 1800; time += 50)
    hands = core.process({
      time,
      detections: [detection("Left"), detection("Right", 0.25, 0.42)],
    });
  const right = hands.find((h) => h.side === "Right")!;
  assert.ok(right.target.x > 0.95);
  assert.ok(right.target.y > 0.65);
  assert.ok(Math.abs(right.target.z - 0.45) < 0.01);
});
test("approaching the camera changes only relative depth; jitter stays inside the dead band", () => {
  const core = ready();
  let right;
  for (let time = 1150; time <= 2200; time += 50)
    right = core
      .process({ time, detections: [detection("Right", 0.3, 0.5, 1.3)] })
      .find((h) => h.side === "Right")!;
  assert.ok(right!.target.z < 0.1);
  assert.ok(Math.abs(right!.target.y - 0.5) < 0.12);
  const before = { ...right!.target };
  for (let time = 2250; time <= 2700; time += 50)
    right = core.process({
      time,
      detections: [
        detection("Right", 0.3 + (time % 100 ? 0.0005 : -0.0005), 0.5, 1.3),
      ],
    })[0];
  assert.ok(Math.abs(right!.target.x - before.x) < 0.015);
});
test("tracking reacquisition holds control until stable and never teleports the target", () => {
  const core = ready();
  const before = { ...core.tracks.Right.target };
  core.process({ time: 1150, detections: [] });
  const first = core.process({
    time: 1450,
    detections: [detection("Right", 0.19, 0.4)],
  })[0];
  assert.equal(first.enabled, false);
  assert.deepEqual(first.target, before);
  let previous = first.target;
  for (let time = 1500; time <= 2100; time += 50) {
    const hand = core.process({
      time,
      detections: [detection("Right", 0.19, 0.4)],
    })[0];
    assert.ok(
      Math.hypot(
        hand.target.x - previous.x,
        hand.target.y - previous.y,
        hand.target.z - previous.z,
      ) <= 0.121,
    );
    previous = hand.target;
  }
});
test("closed hands cannot grab on acquisition; a deliberate stable pinch can grab after opening", () => {
  const core = ready();
  const raw = pinch(detection("Right"));
  assert.equal(gesture(raw.world).closed, true);
  assert.equal(core.process({ time: 1150, detections: [raw] })[0].grip, false);
  assert.equal(core.process({ time: 1200, detections: [raw] })[0].grip, false);
  assert.equal(core.process({ time: 1250, detections: [raw] })[0].grip, true);
  assert.equal(
    core.process({ time: 1300, detections: [detection("Right")] })[0].grip,
    true,
  );
  assert.equal(core.process({ time: 1350, detections: [raw] })[0].grip, true);
  core.process({ time: 2500, detections: [] });
  for (let time = 2550; time <= 3000; time += 50)
    assert.equal(core.process({ time, detections: [raw] })[0].grip, false);
});
test("calibration requires stable open palms and rejects malformed frames", () => {
  const core = new ControlCore();
  assert.equal(core.calibrate(), 0);
  assert.deepEqual(
    core.process({
      time: 0,
      detections: [{ ...detection("Left"), world: [] }],
    }),
    [],
  );
  assert.throws(() => core.process({ time: -1, detections: [] }), /monotonic/);
});

test("a thumbs-up is not a grasp even with four curled fingers", () => {
  const raw = detection("Right");
  for (const base of [5, 9, 13, 17]) {
    const p = raw.world[base];
    raw.world[base + 1] = { x: p.x, y: p.y - 0.025, z: p.z };
    raw.world[base + 2] = { x: p.x, y: p.y - 0.025, z: p.z + 0.02 };
    raw.world[base + 3] = { x: p.x, y: p.y - 0.006, z: p.z + 0.02 };
  }
  raw.world[4] = { ...raw.world[9] };
  assert.equal(gesture(raw.world).closed, true);
  raw.world[4] = { ...raw.world[9], y: raw.world[9].y - 0.14 };
  assert.equal(gesture(raw.world).closed, false);
});
test("crossing trajectories with duplicate labels keep motion identity", () => {
  const core = ready();
  for (let i = 1; i <= 30; i++) {
    const left = detection("Left", 0.7 - i * 0.01),
      right = detection("Right", 0.3 + i * 0.01);
    right.label = "Left";
    const hands = core.process({
      time: 1100 + i * 50,
      detections: i % 2 ? [right, left] : [left, right],
    });
    assert.ok(
      Math.abs(
        hands.find((h) => h.side === "Left")!.landmarks[0].x -
          left.landmarks[0].x,
      ) < 1e-8,
    );
  }
});
test("palm rotation does not become depth and edge-on observations freeze reach", async () => {
  const { palmScale } = await import("../src/control-core");
  const raw = detection("Right"),
    rotated = structuredClone(raw),
    a = Math.PI / 4;
  rotated.world = raw.world.map((p) => ({
    x: p.x * Math.cos(a) + p.z * Math.sin(a),
    y: p.y,
    z: -p.x * Math.sin(a) + p.z * Math.cos(a),
  }));
  rotated.landmarks = rotated.world.map((p) => ({
    x: 0.3 + p.x * 2,
    y: 0.5 + p.y * 2,
    z: p.z * 2,
  }));
  assert.ok(Math.abs(palmScale(rotated).value - palmScale(raw).value) < 1e-6);
  const edge = structuredClone(raw);
  edge.world = raw.world.map((p) => ({ x: p.z, y: p.y, z: -p.x }));
  assert.equal(palmScale(edge).reliable, false);
});
