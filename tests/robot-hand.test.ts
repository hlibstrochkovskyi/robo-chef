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
