import * as T from "three";
import { clamp, distance, type Point, type Side } from "./hand-input";
export interface Item {
  id: string;
  position: Point;
  home: Point;
  radius: number;
  heldBy: Side | null;
  velocity: number;
  rotation: number;
  orientation: T.Quaternion;
  offset: T.Vector3;
  relativeRotation: T.Quaternion;
  state: "free" | "held" | "settling";
}
export interface Contact {
  quaternion: T.Quaternion;
  point: Point;
  camera: boolean;
}
const vector = (p: Point) => new T.Vector3(p.x, p.y, p.z);
export class Interaction {
  items: Item[] = [];
  grips: Record<Side, boolean> = { Left: false, Right: false };
  hover: Record<Side, string | null> = { Left: null, Right: null };
  state: Record<Side, "open" | "holding" | "suspended" | "waiting-open"> = {
    Left: "open",
    Right: "open",
  };
  onGrab: (id: string) => void = () => {};
  onDrop: (id: string) => void = () => {};
  surfaceHeight: (x: number, z: number) => number = () => 0;
  add(id: string, position: Point, radius: number) {
    this.items.push({
      id,
      position: { ...position },
      home: { ...position },
      radius,
      heldBy: null,
      velocity: 0,
      rotation: 0,
      orientation: new T.Quaternion(),
      offset: new T.Vector3(),
      relativeRotation: new T.Quaternion(),
      state: "free",
    });
  }
  private anchor(item: Item, camera: boolean) {
    return vector(item.position).add(
      new T.Vector3(
        camera && item.id === "mug" ? 0.3 : 0,
        0,
        0,
      ).applyQuaternion(item.orientation),
    );
  }
  updateHand(
    side: Side,
    position: Point,
    grip: boolean,
    rotation = 0,
    contact?: Contact,
  ) {
    const q =
        contact?.quaternion ??
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), rotation),
      point = contact?.point ?? position;
    const held = this.items.find((i) => i.heldBy === side);
    const candidates = this.items.filter(
      (i) =>
        !i.heldBy &&
        distance(this.anchor(i, !!contact?.camera), point) <
          (contact?.camera
            ? i.id === "mug"
              ? 0.15
              : i.radius + 0.045
            : i.radius + 0.12),
    );
    candidates.sort(
      (a, b) =>
        distance(this.anchor(a, !!contact?.camera), point) -
        distance(this.anchor(b, !!contact?.camera), point),
    );
    this.hover[side] = candidates[0]?.id ?? null;
    if (this.state[side] === "waiting-open") {
      if (!grip) this.state[side] = "open";
      this.grips[side] = grip;
      return;
    }
    if (held) {
      if (grip) {
        const p = held.offset.clone().applyQuaternion(q).add(vector(position));
        held.position = { x: p.x, y: p.y, z: p.z };
        held.orientation.copy(q).multiply(held.relativeRotation);
        held.rotation = new T.Euler().setFromQuaternion(
          held.orientation,
          "YXZ",
        ).y;
        this.state[side] = "holding";
      } else this.release(side);
    } else if (grip && !this.grips[side] && candidates[0]) {
      const item = candidates[0];
      // A valid handle contact must also leave the palm outside the cup body.
      if (
        contact?.camera &&
        item.id === "mug" &&
        this.penetration(position, 0.1, item).lengthSq() > 1e-7
      ) {
        this.grips[side] = grip;
        return;
      }
      item.heldBy = side;
      item.velocity = 0;
      item.state = "held";
      item.offset.copy(
        vector(item.position)
          .sub(vector(position))
          .applyQuaternion(q.clone().invert()),
      );
      item.relativeRotation.copy(q).invert().multiply(item.orientation);
      this.state[side] = "holding";
      this.onGrab(item.id);
    }
    this.grips[side] = grip;
  }
  held(side: Side) {
    return this.items.find((i) => i.heldBy === side);
  }
  release(side: Side) {
    const item = this.held(side);
    if (item) {
      item.heldBy = null;
      item.velocity = 0;
      item.state = "settling";
      this.onDrop(item.id);
    }
    this.grips[side] = false;
    this.hover[side] = null;
    this.state[side] = "open";
  }
  suspend(side: Side) {
    this.hover[side] = null;
    if (this.held(side)) this.state[side] = "suspended";
  }
  park(side: Side) {
    this.release(side);
    this.state[side] = "waiting-open";
  }
  private support(item: Item, q = item.orientation) {
    const up = new T.Vector3(0, 1, 0).applyQuaternion(q.clone().invert());
    const half = item.home.y - 0.0155;
    return Math.abs(up.y) * half + Math.hypot(up.x, up.z) * item.radius;
  }
  penetration(point: Point, radius: number, item: Item) {
    const p = vector(point)
      .sub(vector(item.position))
      .applyQuaternion(item.orientation.clone().invert());
    const half = item.home.y - 0.0155;
    const radial = Math.hypot(p.x, p.z),
      vertical = Math.abs(p.y);
    if (vertical > half + radius || radial > item.radius + radius)
      return new T.Vector3();
    const side = item.radius + radius - radial,
      cap = half + radius - vertical;
    if (cap < side)
      return new T.Vector3(
        0,
        (p.y >= 0 ? 1 : -1) * (cap + 0.002),
        0,
      ).applyQuaternion(item.orientation);
    return new T.Vector3(
      radial > 1e-6 ? p.x / radial : 1,
      0,
      radial > 1e-6 ? p.z / radial : 0,
    )
      .multiplyScalar(side + 0.002)
      .applyQuaternion(item.orientation);
  }
  constrainMotion(
    side: Side,
    position: Point,
    q: T.Quaternion,
    points: Point[],
  ) {
    const result = vector(position),
      held = this.held(side);
    for (let iteration = 0; iteration < 4; iteration++) {
      let deepest = new T.Vector3();
      for (const item of this.items) {
        if (item.heldBy === side) continue;
        for (const [index, point] of points.entries()) {
          const push = this.penetration(
            vector(point).add(result),
            index === 0 ? 0.1 : 0.027,
            item,
          );
          if (push.lengthSq() > deepest.lengthSq()) deepest = push;
        }
      }
      result.add(deepest);
      if (deepest.lengthSq() < 1e-8) break;
    }
    if (held) {
      const itemQ = q.clone().multiply(held.relativeRotation),
        offset = held.offset.clone().applyQuaternion(q),
        candidate = result.clone().add(offset);
      const floor =
        0.0155 +
        this.surfaceHeight(candidate.x, candidate.z) +
        this.support(held, itemQ);
      result.y += Math.max(0, floor - candidate.y);
      for (const other of this.items) {
        if (other === held || other.heldBy === side) continue;
        const p = result.clone().add(offset),
          dy = Math.abs(p.y - other.position.y);
        if (dy > this.support(held, itemQ) + this.support(other)) continue;
        const dx = p.x - other.position.x,
          dz = p.z - other.position.z,
          range = held.radius + other.radius + 0.012,
          length = Math.hypot(dx, dz);
        if (length < range) {
          result.x += (length > 1e-6 ? dx / length : 1) * (range - length);
          result.z += (length > 1e-6 ? dz / length : 0) * (range - length);
        }
      }
    }
    result.x = clamp(
      result.x,
      side === "Left" ? -2.55 : -0.45,
      side === "Left" ? 0.45 : 2.55,
    );
    result.y = clamp(result.y, 0.22, 1.5);
    result.z = clamp(result.z, -1.3, 1.6);
    return result;
  }
  tick(dt: number) {
    const steps = Math.max(1, Math.ceil(dt / 0.02)),
      step = dt / steps;
    for (let n = 0; n < steps; n++)
      for (const item of this.items)
        if (!item.heldBy) {
          if (item.state === "settling") {
            const yaw = new T.Quaternion().setFromAxisAngle(
              new T.Vector3(0, 1, 0),
              item.rotation,
            );
            item.orientation.slerp(yaw, 1 - Math.exp(-12 * step));
          }
          item.velocity -= 5 * step;
          const floor =
            0.0155 +
            this.surfaceHeight(item.position.x, item.position.z) +
            this.support(item);
          item.position.y = Math.max(
            floor,
            item.position.y + item.velocity * step,
          );
          if (item.position.y === floor) {
            item.velocity = 0;
            if (
              item.orientation.angleTo(
                new T.Quaternion().setFromAxisAngle(
                  new T.Vector3(0, 1, 0),
                  item.rotation,
                ),
              ) < 0.01
            )
              item.state = "free";
          }
        }
  }
  reset() {
    for (const item of this.items) {
      item.position = { ...item.home };
      item.heldBy = null;
      item.velocity = 0;
      item.rotation = 0;
      item.orientation.identity();
      item.state = "free";
    }
    this.grips = { Left: false, Right: false };
    this.hover = { Left: null, Right: null };
    this.state = { Left: "open", Right: "open" };
  }
}
