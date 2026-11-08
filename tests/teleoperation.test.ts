import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { ControlCore, centroid, type Detection } from "../src/control-core";
import { RobotHand } from "../src/robot-hand";
import { Interaction } from "../src/interaction";
import { applyHandControl } from "../src/teleoperation";
import { detection, pinch } from "./fixtures/hands";
test("calibrated landmark pipeline reaches a mug handle, carries it, and releases without snapping", () => {
  const core = new ControlCore(),
    robot = new RobotHand("Right", new T.Scene()),
    world = new Interaction();
  world.add("mug", { x: 0, y: 0.24, z: 0 }, 0.23);
  let time = 0;
  function send(raw: Detection) {
    const command = core.process({ time, detections: [raw] })[0];
    time += 50;
    if (command)
      for (let i = 0; i < 3; i++) {
        applyHandControl(robot, world, command, 1 / 60);
        world.tick(1 / 60);
      }
    return command;
  }
  for (let i = 0; i < 20; i++) send(detection("Right"));
  assert.equal(core.calibrate(), 1);
  for (let i = 0; i < 8; i++) send(detection("Right"));
  const neutral = core.tracks.Right.neutral!;
  const closed = pinch(detection("Right"));
  robot.pose({ ...closed, side: "Right", grip: true }, neutral.world);
  robot.position.set(0, 0.5, 0);
  robot.target.copy(robot.position);
  for (let i = 0; i < 50; i++) robot.update(1 / 60);
  const local = robot.graspPoint().sub(robot.position);
  const goal = new T.Vector3(0.3, 0.24, 0).sub(local);
  assert.ok(
    goal.x > -0.4 && goal.x < 2.5,
    `goal outside workspace: ${goal.toArray()}`,
  );
  function at(target: T.Vector3, grip = false) {
    const ratio = Math.exp((0.45 - target.z) / 3),
      prototype = detection("Right", 0, 0, ratio),
      offset = centroid(prototype.landmarks);
    const raw = detection(
      "Right",
      neutral.center.x + (0.95 - target.x) / 5 - offset.x,
      neutral.center.y + (0.5 - target.y) / 2.8 - offset.y,
      ratio,
    );
    return grip ? pinch(raw) : raw;
  }
  for (let i = 0; i < 60; i++) {
    const t = Math.min(1, i / 35);
    send(at(new T.Vector3(0.95, 0.5, 0.45).lerp(goal, t)));
  }
  const before = { ...world.items[0].position };
  for (let i = 0; i < 40 && !world.held("Right"); i++) send(at(goal, true));
  assert.equal(
    world.items[0].heldBy,
    "Right",
    JSON.stringify({
      goal,
      local,
      root: robot.position,
      contact: robot.graspPoint(),
      item: world.items[0].position,
      state: world.state.Right,
    }),
  );
  assert.ok(
    new T.Vector3()
      .copy(world.items[0].position)
      .distanceTo(new T.Vector3().copy(before)) < 0.02,
    "attachment snapped",
  );
  const offset = world.items[0].offset.clone();
  const destination = goal.clone().add(new T.Vector3(0.5, 0.5, 0.25));
  for (let i = 0; i < 60; i++)
    send(at(goal.clone().lerp(destination, Math.min(1, i / 35)), true));
  const relative = new T.Vector3()
    .copy(world.items[0].position)
    .sub(robot.position)
    .applyQuaternion(robot.palm.quaternion.clone().invert());
  assert.ok(relative.distanceTo(offset) < 1e-5);
  for (let i = 0; i < 12; i++) send(at(destination, false));
  for (let i = 0; i < 120; i++) world.tick(1 / 60);
  assert.equal(world.items[0].heldBy, null);
  assert.ok(world.items[0].position.x > 0.3);
});
