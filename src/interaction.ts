import { clamp, distance, type Point, type Side } from "./hand-input";
export interface Item {
  id: string;
  position: Point;
  home: Point;
  radius: number;
  heldBy: Side | null;
  velocity: number;
  rotation: number;
}
export class Interaction {
  items: Item[] = [];
  grips: Record<Side, boolean> = { Left: false, Right: false };
  hover: Record<Side, string | null> = { Left: null, Right: null };
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
    });
  }
  updateHand(side: Side, position: Point, grip: boolean, rotation = 0) {
    const held = this.items.find((i) => i.heldBy === side);
    const nearest = this.items
      .filter(
        (i) => !i.heldBy && distance(i.position, position) < i.radius + 0.45,
      )
      .sort(
        (a, b) =>
          distance(a.position, position) - distance(b.position, position),
      )[0];
    this.hover[side] = nearest?.id ?? null;
    if (held) {
      if (grip) {
        held.position = {
          x: clamp(position.x, -2.7, 2.7),
          y: Math.max(held.home.y, position.y),
          z: clamp(position.z, -1.5, 1.8),
        };
        held.rotation = rotation;
      } else {
        held.heldBy = null;
        held.velocity = 0;
        this.onDrop(held.id);
      }
    } else if (grip && !this.grips[side] && nearest) {
      nearest.heldBy = side;
      nearest.velocity = 0;
      this.onGrab(nearest.id);
    }
    this.grips[side] = grip;
  }
  release(side: Side) {
    const held = this.items.find((i) => i.heldBy === side);
    if (held) {
      held.heldBy = null;
      held.velocity = 0;
      this.onDrop(held.id);
    }
    this.grips[side] = false;
    this.hover[side] = null;
  }
  tick(dt: number) {
    for (const item of this.items)
      if (!item.heldBy) {
        item.velocity -= 5 * dt;
        const floor =
          item.home.y + this.surfaceHeight(item.position.x, item.position.z);
        item.position.y = Math.max(floor, item.position.y + item.velocity * dt);
        if (item.position.y === floor) item.velocity = 0;
      }
  }
  reset() {
    this.items.forEach((i) => {
      i.position = { ...i.home };
      i.heldBy = null;
      i.velocity = 0;
      i.rotation = 0;
    });
    this.grips = { Left: false, Right: false };
    this.hover = { Left: null, Right: null };
  }
}
