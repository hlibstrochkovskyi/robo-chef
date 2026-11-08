import * as T from "three";
import type { Point, Side } from "./hand-input";
import { clamp } from "./hand-input";
export function restPose(side: Side, grip = false) {
  const sign = side === "Left" ? -1 : 1,
    points = [new T.Vector3(0, 0, 0.25)];
  for (let finger = 0; finger < 5; finger++)
    for (let joint = 0; joint < 4; joint++) {
      if (finger === 0)
        points.push(
          new T.Vector3(
            sign * (-0.22 - joint * 0.055),
            grip ? 0.03 + joint * 0.035 : 0,
            0.11 - joint * 0.065,
          ),
        );
      else
        points.push(
          new T.Vector3(
            sign * ((finger - 1) * 0.115 - 0.17),
            grip ? 0.04 + Math.sin((joint / 3) * Math.PI) * 0.17 : 0.01,
            -0.03 -
              joint * (finger === 4 ? 0.085 : 0.105) +
              (grip ? joint * 0.08 : 0),
          ),
        );
    }
  const center = points[0].clone().lerp(points[9], 0.53);
  return points.map((p) => p.sub(center));
}
const cameraVector = (p: Point) => new T.Vector3(-p.x, -p.z, p.y);
function frame(points: Point[], side: Side) {
  const p = points.map(cameraVector),
    z = p[0].clone().sub(p[9]).normalize(),
    x = p[17].clone().sub(p[5]);
  if (side === "Left") x.negate();
  const y = z.clone().cross(x).normalize();
  x.copy(y).cross(z).normalize();
  if (Math.min(x.lengthSq(), y.lengthSq(), z.lengthSq()) < 0.5) return null;
  return {
    points: p,
    orientation: new T.Quaternion().setFromRotationMatrix(
      new T.Matrix4().makeBasis(x, y, z),
    ),
  };
}
export function retargetPose(points: Point[], reference: Point[], side: Side) {
  const rest = restPose(side),
    canonical = rest.map((p) => p.clone()),
    current = frame(points, side),
    neutral = frame(reference, side);
  if (!current || !neutral) return rest;
  const rotation = current.orientation
    .clone()
    .multiply(neutral.orientation.clone().invert());
  const limit = 1.15,
    angle = rotation.angleTo(new T.Quaternion());
  if (angle > limit) rotation.slerp(new T.Quaternion(), 1 - limit / angle);
  const inverse = current.orientation.clone().invert();
  for (const base of [1, 5, 9, 13, 17]) {
    let pitch = 0,
      yaw = 0;
    let previous = new T.Vector3(0, 0, -1);
    for (let j = 0; j < 3; j++) {
      const raw = current.points[base + j + 1]
        .clone()
        .sub(current.points[base + j])
        .applyQuaternion(inverse)
        .normalize();
      let direction: T.Vector3;
      if (base === 1) {
        const initial = rest[base + j + 1]
          .clone()
          .sub(rest[base + j])
          .normalize();
        const turn = initial.angleTo(raw);
        direction = initial
          .clone()
          .lerp(raw, turn > 1.2 ? 1.2 / turn : 1)
          .normalize();
      } else {
        if (j === 0) {
          pitch = clamp(
            Math.atan2(-raw.y, Math.hypot(raw.x, raw.z)),
            -0.12,
            1.4,
          );
          yaw = clamp(Math.atan2(raw.x, -raw.z), -0.42, 0.42);
        } else {
          const bend = Math.atan2(
            -previous.clone().cross(raw).x,
            previous.dot(raw),
          );
          pitch += clamp(bend, -0.05, j === 1 ? 1.65 : 1.3);
        }
        pitch = clamp(pitch, -0.15, 2.85);
        direction = new T.Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          -Math.sin(pitch),
          -Math.cos(yaw) * Math.cos(pitch),
        );
      }
      const length = canonical[base + j].distanceTo(canonical[base + j + 1]);
      rest[base + j + 1]
        .copy(rest[base + j])
        .addScaledVector(direction, length);
      previous = raw;
    }
  }
  return rest.map((p) => p.applyQuaternion(rotation));
}
export const ARM_UPPER = 2.0,
  ARM_FOREARM = 1.9;
export function solveArm(side: Side, target: T.Vector3) {
  const shoulder = new T.Vector3(side === "Left" ? -1.45 : 1.45, 0.35, 2.85);
  const direction = target.clone().sub(shoulder),
    distance = clamp(direction.length(), 0.25, ARM_UPPER + ARM_FOREARM - 0.025);
  if (direction.lengthSq() < 1e-9) direction.set(0, 0, -1);
  else direction.normalize();
  const wrist = shoulder.clone().addScaledVector(direction, distance);
  const bend = new T.Vector3(
    side === "Left" ? -1 : 1,
    -0.12,
    0.15,
  ).addScaledVector(
    direction,
    -new T.Vector3(side === "Left" ? -1 : 1, -0.12, 0.15).dot(direction),
  );
  if (bend.lengthSq() < 1e-8) bend.set(0, 1, 0);
  bend.normalize();
  const along =
      (ARM_UPPER ** 2 - ARM_FOREARM ** 2 + distance ** 2) / (2 * distance),
    height = Math.sqrt(Math.max(0, ARM_UPPER ** 2 - along ** 2));
  const elbow = shoulder
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(bend, height);
  return { shoulder, elbow, wrist };
}
