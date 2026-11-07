import { test } from "node:test";
import assert from "node:assert/strict";
import { Interaction } from "../src/interaction";
import { isGripping, tablePosition, type Point } from "../src/hand-input";

test("grabs only nearby objects on a fresh grip, carries and drops onto the table", () => {
  const world = new Interaction();
  world.add("cup", { x: 0, y: 0.24, z: 0 }, 0.23);
  world.updateHand("Right", { x: 2, y: 0.4, z: 0 }, true);
  assert.equal(world.items[0].heldBy, null);
  world.updateHand("Right", { x: 0, y: 0.4, z: 0 }, true);
  assert.equal(world.items[0].heldBy, null);
  world.updateHand("Right", { x: 0, y: 0.4, z: 0 }, false);
  world.updateHand("Right", { x: 0, y: 0.4, z: 0 }, true);
  assert.equal(world.items[0].heldBy, "Right");
  world.updateHand("Right", { x: 1, y: 1, z: 0.5 }, true);
  assert.equal(world.items[0].position.x, 1);
  world.updateHand("Right", { x: 1, y: 1, z: 0.5 }, false);
  for (let i = 0; i < 120; i++) world.tick(1 / 60);
  assert.deepEqual(world.items[0].position, { x: 1, y: 0.24, z: 0.5 });
});
test("two hands cannot own the same object; loss of tracking releases it", () => {
  const world = new Interaction();
  world.add("cup", { x: 0, y: 0.24, z: 0 }, 0.23);
  world.updateHand("Left", { x: 0, y: 0.3, z: 0 }, true);
  world.updateHand("Right", { x: 0, y: 0.3, z: 0 }, true);
  assert.equal(world.items[0].heldBy, "Left");
  world.release("Left");
  assert.equal(world.items[0].heldBy, null);
  world.reset();
  assert.deepEqual(world.items[0].position, world.items[0].home);
  assert.equal(world.grips.Right, false);
});
test("pinch threshold is scale independent and has release hysteresis", () => {
  const p: Point[] = Array.from({ length: 21 }, (_, i) => ({
    x: i * 0.1,
    y: 1,
    z: 0,
  }));
  p[0] = { x: 0, y: 0, z: 0 };
  p[9] = { x: 0, y: 1, z: 0 };
  p[4] = { x: 0, y: 2, z: 0 };
  p[8] = { x: 0.25, y: 2, z: 0 };
  for (const tip of [12, 16, 20]) p[tip].y = 4;
  assert.equal(isGripping(p), true);
  assert.equal(
    isGripping(p.map((a) => ({ x: a.x * 4, y: a.y * 4, z: a.z * 4 }))),
    true,
  );
  p[8].x = 0.42;
  assert.equal(isGripping(p, false), false);
  assert.equal(isGripping(p, true), true);
  p[8].x = 0.7;
  assert.equal(isGripping(p, true), false);
  assert.equal(isGripping([]), false);
});
test("camera mapping mirrors X and bounds approximate depth and height", () => {
  assert.ok(tablePosition({ x: 0.2, y: 0.5, z: 0 }, 0.16, 0.16).x > 0);
  const extreme = tablePosition({ x: 9, y: -9, z: 9 }, 0.16, 8);
  assert.equal(extreme.x, -2.6);
  assert.equal(extreme.z, -1.15);
  assert.equal(extreme.y, 1.25);
});
