import { test } from "node:test";
import assert from "node:assert/strict";
import { Interaction } from "../src/interaction";

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
