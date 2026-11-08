import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { Interaction } from "../src/interaction";
const identity = new T.Quaternion();
function world() {
  const w = new Interaction();
  w.add("mug", { x: 0, y: 0.24, z: 0 }, 0.23);
  return w;
}
test("camera grasp requires a handle contact and does not snap the mug on attachment", () => {
  const w = world(),
    hand = { x: 0.48, y: 0.3, z: 0.25 };
  w.updateHand("Right", hand, true, 0, {
    quaternion: identity,
    point: { x: 0, y: 0.24, z: 0 },
    camera: true,
  });
  assert.equal(w.items[0].heldBy, null);
  w.updateHand("Right", hand, false);
  const before = { ...w.items[0].position };
  w.updateHand("Right", hand, true, 0, {
    quaternion: identity,
    point: { x: 0.3, y: 0.24, z: 0 },
    camera: true,
  });
  assert.equal(w.items[0].heldBy, "Right");
  assert.deepEqual(w.items[0].position, before);
});
test("held mug preserves its full relative transform through translation and rotation", () => {
  const w = world(),
    hand = { x: 0.48, y: 0.3, z: 0.25 };
  w.updateHand("Right", hand, true, 0, {
    quaternion: identity,
    point: { x: 0.3, y: 0.24, z: 0 },
    camera: true,
  });
  const offset = w.items[0].offset.clone(),
    q = new T.Quaternion().setFromEuler(new T.Euler(0.25, 0.9, 0.2)),
    next = { x: 1, y: 0.9, z: 0.6 };
  w.updateHand("Right", next, true, 0, {
    quaternion: q,
    point: next,
    camera: true,
  });
  const local = new T.Vector3(
    ...(Object.values(w.items[0].position) as [number, number, number]),
  )
    .sub(new T.Vector3(1, 0.9, 0.6))
    .applyQuaternion(q.clone().invert());
  assert.ok(local.distanceTo(offset) < 1e-6);
  assert.ok(w.items[0].orientation.angleTo(q) < 1e-6);
});
test("short tracking loss suspends ownership; long loss parks and requires an open hand", () => {
  const w = world();
  w.updateHand("Right", { x: 0, y: 0.3, z: 0 }, true);
  w.suspend("Right");
  assert.equal(w.items[0].heldBy, "Right");
  assert.equal(w.state.Right, "suspended");
  w.park("Right");
  assert.equal(w.items[0].heldBy, null);
  w.updateHand("Right", { x: 0, y: 0.3, z: 0 }, true);
  assert.equal(w.items[0].heldBy, null);
  w.updateHand("Right", { x: 0, y: 0.3, z: 0 }, false);
  w.updateHand("Right", { x: 0, y: 0.3, z: 0 }, true);
  assert.equal(w.items[0].heldBy, "Right");
});
test("collision proxy pushes palm out of the mug and supports a tilted held body above the table", () => {
  const w = world();
  const moved = w.constrainMotion("Right", { x: 0.1, y: 0.3, z: 0 }, identity, [
    { x: 0, y: 0, z: 0 },
  ]);
  assert.equal(w.penetration(moved, 0.1, w.items[0]).lengthSq(), 0);
  w.updateHand("Right", { x: 0, y: 0.3, z: 0 }, true);
  const q = new T.Quaternion().setFromAxisAngle(
      new T.Vector3(0, 0, 1),
      Math.PI / 3,
    ),
    safe = w.constrainMotion("Right", { x: 1, y: 0.1, z: 0 }, q, []);
  w.updateHand("Right", safe, true, 0, {
    quaternion: q,
    point: safe,
    camera: false,
  });
  assert.ok(w.items[0].position.y > 0.2);
});
test("ten synthetic pick carry release cycles keep ownership and placement predictable", () => {
  const w = world();
  for (let cycle = 0; cycle < 10; cycle++) {
    const start = { ...w.items[0].position, y: w.items[0].position.y + 0.1 };
    w.updateHand("Right", start, false);
    w.updateHand("Right", start, true);
    assert.equal(w.items[0].heldBy, "Right");
    const target = { x: cycle % 2 ? 0 : 1, y: 0.8, z: 0.2 };
    w.updateHand("Right", target, true);
    w.updateHand("Right", target, false);
    for (let frame = 0; frame < 120; frame++) w.tick(1 / 60);
    assert.equal(w.items[0].heldBy, null);
    assert.ok(Math.abs(w.items[0].position.y - w.items[0].home.y) < 1e-6);
  }
});
