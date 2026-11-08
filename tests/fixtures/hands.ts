import { restPose } from "../../src/robot-hand";
import type { Detection } from "../../src/control-core";
import type { Side } from "../../src/hand-input";
export function detection(
  side: Side,
  x = side === "Left" ? 0.7 : 0.3,
  y = 0.5,
  scale = 1,
): Detection {
  const world = restPose(side).map((p) => ({
    x: -p.x * 0.25,
    y: p.z * 0.25,
    z: -p.y * 0.25,
  }));
  return {
    label: side,
    score: 0.95,
    world,
    landmarks: world.map((p) => ({
      x: x + p.x * 2 * scale,
      y: y + p.y * 2 * scale,
      z: p.z * 2 * scale,
    })),
  };
}
export function pinch(d: Detection) {
  const copy = structuredClone(d);
  copy.world[4] = { ...copy.world[8], x: copy.world[8].x + 0.006 };
  copy.landmarks[4] = { ...copy.landmarks[8], x: copy.landmarks[8].x + 0.012 };
  return copy;
}
