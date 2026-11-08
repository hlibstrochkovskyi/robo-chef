import {
  clamp,
  distance,
  type HandInput,
  type Point,
  type Side,
} from "./hand-input";

export interface Detection {
  label: Side;
  score: number;
  landmarks: Point[];
  world: Point[];
}
export interface InputFrame {
  time: number;
  detections: Detection[];
}
export type TrackingState = "acquiring" | "tracking" | "recovering" | "missing";
export interface ControlHand extends HandInput {
  target: Point;
  rawTarget: Point;
  state: TrackingState;
  enabled: boolean;
  calibrated: boolean;
  rawLabel: Side;
  score: number;
  time: number;
  reference: Point[];
}
interface Sample {
  time: number;
  center: Point;
  scale: number;
  open: boolean;
  world: Point[];
}
interface Neutral {
  center: Point;
  scale: number;
  world: Point[];
}
interface Track {
  side: Side;
  last: number;
  acquired: number;
  center: Point;
  velocity: Point;
  samples: Sample[];
  neutral: Neutral | null;
  target: Point;
  rawTarget: Point;
  observed: Detection | null;
  state: TrackingState;
  grip: boolean;
  pending: boolean;
  pendingSince: number;
  armed: boolean;
  openSince: number;
  depth: number;
  lastUpdate: number;
}
const sides: Side[] = ["Left", "Right"];
export const centroid = (p: Point[]) =>
  [0, 5, 9, 17].reduce(
    (a, i) => ({
      x: a.x + p[i].x / 4,
      y: a.y + p[i].y / 4,
      z: a.z + p[i].z / 4,
    }),
    { x: 0, y: 0, z: 0 },
  );
const xy = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a: Point, b: Point) => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Point, b: Point) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (p: Point) => Math.hypot(p.x, p.y, p.z);
const angle = (a: Point, b: Point) =>
  Math.acos(clamp(dot(a, b) / Math.max(norm(a) * norm(b), 1e-9), -1, 1));
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
export function fingerCurl(p: Point[], base: number) {
  return (
    angle(sub(p[base + 1], p[base]), sub(p[base + 2], p[base + 1])) +
    angle(sub(p[base + 2], p[base + 1]), sub(p[base + 3], p[base + 2]))
  );
}
export function gesture(p: Point[], held = false) {
  const scale = Math.max(distance(p[0], p[9]), 0.001);
  const pinch = distance(p[4], p[8]) / scale;
  const curls = [5, 9, 13, 17].map((i) => fingerCurl(p, i));
  const fist =
    curls.filter((v) => v > (held ? 0.85 : 1.1)).length >= (held ? 3 : 4) &&
    distance(p[4], p[9]) / scale < (held ? 1.05 : 0.85);
  return {
    closed: pinch < (held ? 0.45 : 0.28) || fist,
    open: curls.filter((v) => v < 0.65).length >= 3 && pinch > 0.55,
    pinch,
  };
}
// Projected palm area corrected for foreshortening. It is a relative scale cue, not metric depth.
export function palmScale(d: Detection) {
  const p = d.landmarks,
    w = d.world;
  const a = sub(p[5], p[0]),
    b = sub(p[17], p[0]);
  const normal = cross(sub(w[5], w[0]), sub(w[17], w[0]));
  const facing = Math.abs(normal.z) / Math.max(norm(normal), 1e-8);
  return {
    value: Math.sqrt(Math.abs(a.x * b.y - a.y * b.x) / Math.max(facing, 0.35)),
    reliable: facing > 0.5,
  };
}
function valid(d: Detection) {
  return (
    sides.includes(d.label) &&
    Number.isFinite(d.score) &&
    d.landmarks.length === 21 &&
    d.world.length === 21 &&
    [...d.landmarks, ...d.world].every((p) =>
      [p.x, p.y, p.z].every(Number.isFinite),
    ) &&
    distance(d.world[0], d.world[9]) > 0.015
  );
}
export class ControlCore {
  tracks: Record<Side, Track>;
  time = -1;
  constructor() {
    this.tracks = {
      Left: this.newTrack("Left"),
      Right: this.newTrack("Right"),
    };
  }
  private newTrack(side: Side): Track {
    return {
      side,
      last: -Infinity,
      acquired: 0,
      center: { x: side === "Left" ? 0.7 : 0.3, y: 0.55, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      samples: [],
      neutral: null,
      target: { x: side === "Left" ? -0.95 : 0.95, y: 0.5, z: 0.45 },
      rawTarget: { x: side === "Left" ? -0.95 : 0.95, y: 0.5, z: 0.45 },
      observed: null,
      state: "missing",
      grip: false,
      pending: false,
      pendingSince: 0,
      armed: false,
      openSince: -1,
      depth: 0.45,
      lastUpdate: 0,
    };
  }
  reset() {
    this.tracks = {
      Left: this.newTrack("Left"),
      Right: this.newTrack("Right"),
    };
    this.time = -1;
  }
  process(frame: InputFrame): ControlHand[] {
    if (!Number.isFinite(frame.time) || frame.time < this.time)
      throw new Error("Tracking timestamps must be monotonic.");
    this.time = frame.time;
    const detections = frame.detections.filter(valid).slice(0, 2);
    const centers = detections.map((d) => centroid(d.landmarks));
    const cost = (track: Track, index: number) => {
      if (index < 0) return 0.8;
      const center = centers[index],
        age = frame.time - track.last;
      if (age < 1600) {
        const dt = Math.min(age / 1000, 0.15),
          pred = {
            x: track.center.x + track.velocity.x * dt,
            y: track.center.y + track.velocity.y * dt,
            z: 0,
          };
        const separation = xy(pred, center);
        if (separation > Math.min(0.32, 0.11 + (age / 1000) * 0.75)) return 100;
        return (
          separation * 4 + (detections[index].label !== track.side ? 0.035 : 0)
        );
      }
      const sidePenalty = (
        track.side === "Left" ? center.x < 0.5 : center.x > 0.5
      )
        ? 0.15
        : 0;
      return (detections[index].label !== track.side ? 0.35 : 0) + sidePenalty;
    };
    let best = [-1, -1],
      bestCost = Infinity;
    for (let left = -1; left < detections.length; left++)
      for (let right = -1; right < detections.length; right++) {
        if (left >= 0 && left === right) continue;
        const value =
          cost(this.tracks.Left, left) + cost(this.tracks.Right, right);
        if (value < bestCost) {
          bestCost = value;
          best = [left, right];
        }
      }
    const result: ControlHand[] = [];
    sides.forEach((side, slot) => {
      const t = this.tracks[side],
        index = best[slot],
        age = frame.time - t.last;
      if (index < 0) {
        t.observed = null;
        t.state = "missing";
        t.pending = t.grip;
        t.pendingSince = frame.time;
        if (age > 1000) {
          t.grip = false;
          t.armed = false;
          t.openSince = -1;
        }
        return;
      }
      const detection = detections[index],
        center = centers[index];
      const gap = age > 150;
      if (gap) {
        t.acquired = frame.time;
        t.samples = [];
        t.velocity = { x: 0, y: 0, z: 0 };
        t.pending = t.grip;
        t.pendingSince = frame.time;
        if (age > 1000) {
          t.armed = false;
          t.grip = false;
          t.openSince = -1;
        }
      }
      const delta = Math.max((frame.time - t.last) / 1000, 0.001);
      if (!gap)
        t.velocity = {
          x:
            clamp((center.x - t.center.x) / delta, -1.5, 1.5) * 0.5 +
            t.velocity.x * 0.5,
          y:
            clamp((center.y - t.center.y) / delta, -1.5, 1.5) * 0.5 +
            t.velocity.y * 0.5,
          z: 0,
        };
      t.center = center;
      t.last = frame.time;
      t.observed = detection;
      const stable = frame.time - t.acquired >= 200;
      t.state = stable ? "tracking" : t.neutral ? "recovering" : "acquiring";
      const scale = palmScale(detection),
        g = gesture(detection.world, t.grip);
      t.samples.push({
        time: frame.time,
        center,
        scale: scale.value,
        open: g.open && scale.reliable,
        world: detection.world,
      });
      t.samples = t.samples.filter((s) => frame.time - s.time < 700);
      if (stable && t.neutral) {
        const dt = clamp((frame.time - t.lastUpdate) / 1000, 0.001, 0.1);
        const desired = {
          x:
            (side === "Left" ? -0.95 : 0.95) +
            (t.neutral.center.x - center.x) * 5,
          y: clamp(0.5 + (t.neutral.center.y - center.y) * 2.8, 0.23, 1.3),
          z: t.depth,
        };
        if (scale.reliable && scale.value > 0.005) {
          const z = clamp(
            0.45 - 3 * Math.log(scale.value / t.neutral.scale),
            -1.25,
            1.5,
          );
          if (Math.abs(z - t.depth) > 0.025)
            t.depth += (z - t.depth) * (1 - Math.exp(-8 * dt));
        }
        desired.x = clamp(
          desired.x,
          side === "Left" ? -2.5 : -0.4,
          side === "Left" ? 0.4 : 2.5,
        );
        desired.z = t.depth;
        t.rawTarget = { ...desired };
        const separation = distance(desired, t.target),
          alpha = 1 - Math.exp(-14 * dt),
          step = Math.min(alpha, separation > 0 ? (2.4 * dt) / separation : 1);
        if (separation > 0.008)
          t.target = {
            x: t.target.x + (desired.x - t.target.x) * step,
            y: t.target.y + (desired.y - t.target.y) * step,
            z: t.target.z + (desired.z - t.target.z) * step,
          };
        if (!t.armed) {
          if (g.open) {
            if (t.openSince < 0) t.openSince = frame.time;
            if (frame.time - t.openSince >= 150) t.armed = true;
          } else t.openSince = -1;
        }
        const candidate = t.armed && g.closed;
        if (candidate !== t.pending) {
          t.pending = candidate;
          t.pendingSince = frame.time;
        }
        if (frame.time - t.pendingSince >= 100) t.grip = candidate;
      }
      t.lastUpdate = frame.time;
      result.push({
        side,
        landmarks: detection.landmarks,
        world: detection.world,
        grip: t.grip,
        target: { ...t.target },
        rawTarget: { ...t.rawTarget },
        state: t.state,
        enabled: stable && !!t.neutral,
        calibrated: !!t.neutral,
        rawLabel: detection.label,
        score: detection.score,
        time: frame.time,
        reference: t.neutral?.world ?? detection.world,
      });
    });
    return result;
  }
  canCalibrate(side: Side) {
    const t = this.tracks[side],
      samples = t.samples;
    if (
      t.state !== "tracking" ||
      samples.length < 6 ||
      samples.at(-1)!.time - samples[0].time < 350 ||
      !samples.every((s) => s.open && s.scale > 0.005)
    )
      return false;
    const center = {
      x: median(samples.map((s) => s.center.x)),
      y: median(samples.map((s) => s.center.y)),
      z: 0,
    };
    const size = median(samples.map((s) => s.scale));
    return samples.every(
      (s) =>
        xy(s.center, center) < 0.025 && Math.abs(s.scale - size) / size < 0.12,
    );
  }
  calibrate() {
    let count = 0;
    for (const side of sides) {
      const t = this.tracks[side];
      if (!this.canCalibrate(side)) continue;
      t.neutral = {
        center: {
          x: median(t.samples.map((s) => s.center.x)),
          y: median(t.samples.map((s) => s.center.y)),
          z: 0,
        },
        scale: median(t.samples.map((s) => s.scale)),
        world: t.samples[Math.floor(t.samples.length / 2)].world.map((p) => ({
          ...p,
        })),
      };
      t.target = { x: side === "Left" ? -0.95 : 0.95, y: 0.5, z: 0.45 };
      t.depth = 0.45;
      t.grip = false;
      t.pending = false;
      t.armed = false;
      t.openSince = -1;
      count++;
    }
    return count;
  }
}
