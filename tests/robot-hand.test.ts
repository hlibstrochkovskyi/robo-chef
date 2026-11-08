import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { RobotHand } from "../src/robot-hand";

test("both mirrored hand backs face upward in their rest pose", () => {
  for (const side of ["Left", "Right"] as const) {
    const scene = new T.Scene(),
      hand = new RobotHand(side, scene);
    hand.update(1);
    const normal = new T.Vector3(0, 1, 0).applyQuaternion(hand.palm.quaternion);
    assert.ok(normal.y > 0.98, `${side} palm normal: ${normal.toArray()}`);
  }
});
test("open, gripping, and collapsed landmarks keep all robot transforms finite", () => {
  const scene = new T.Scene(),
    hand = new RobotHand("Right", scene);
  for (const grip of [false, true]) {
    hand.demo(grip);
    hand.update(1);
  }
  hand.targets = Array.from({ length: 21 }, () => new T.Vector3());
  for (let i = 0; i < 10; i++) hand.update(1);
  scene.updateMatrixWorld(true);
  scene.traverse((part) =>
    assert.ok(
      part.matrixWorld.elements.every(Number.isFinite),
      part.name || part.type,
    ),
  );
});

test("arm segments keep their physical lengths even for unreachable targets", async () => {
  const { solveArm, ARM_UPPER, ARM_FOREARM } = await import("../src/hand-pose");
  for (const side of ["Left", "Right"] as const)
    for (const target of [
      new T.Vector3(0, 0.5, 0.4),
      new T.Vector3(90, 50, -90),
      new T.Vector3(-1.45, 0.35, 2.85),
    ]) {
      const arm = solveArm(side, target);
      assert.ok(
        Math.abs(arm.shoulder.distanceTo(arm.elbow) - ARM_UPPER) < 1e-6,
      );
      assert.ok(Math.abs(arm.elbow.distanceTo(arm.wrist) - ARM_FOREARM) < 1e-6);
    }
});
test("retargeted finger segments keep their lengths across scaled and curled detections", async () => {
  const { retargetPose, restPose } = await import("../src/hand-pose");
  const { detection, pinch } = await import("./fixtures/hands");
  for (const side of ["Left", "Right"] as const) {
    const reference = detection(side),
      raw = pinch(reference);
    raw.world = raw.world.map((p) => ({
      x: p.x * 1.5,
      y: p.y * 1.5,
      z: p.z * 1.5,
    }));
    const result = retargetPose(raw.world, reference.world, side),
      rest = restPose(side);
    for (const base of [1, 5, 9, 13, 17])
      for (let j = 0; j < 3; j++)
        assert.ok(
          Math.abs(
            result[base + j].distanceTo(result[base + j + 1]) -
              rest[base + j].distanceTo(rest[base + j + 1]),
          ) < 1e-6,
        );
  }
});
