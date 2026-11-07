export interface Point {
  x: number;
  y: number;
  z: number;
}
export type Side = "Left" | "Right";
export interface HandInput {
  side: Side;
  landmarks: Point[];
  world: Point[];
  grip: boolean;
}
export const CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
// Relative measurements keep the gesture usable at different camera distances.
export function isGripping(points: Point[], wasGripping = false): boolean {
  if (points.length !== 21) return false;
  const scale = Math.max(distance(points[0], points[9]), 0.001);
  const pinch = distance(points[4], points[8]) / scale;
  const folded = [8, 12, 16, 20].filter(
    (tip) =>
      distance(points[tip], points[0]) <
      distance(points[tip - 2], points[0]) * 1.15,
  ).length;
  return pinch < (wasGripping ? 0.52 : 0.34) || folded >= (wasGripping ? 2 : 3);
}
export function tablePosition(
  wrist: Point,
  neutralSize: number,
  palmSize: number,
): Point {
  // Camera Y controls reach. Palm size gives only a small, bounded lift cue.
  return {
    x: clamp((0.5 - wrist.x) * 7.8, -2.6, 2.6),
    y: clamp(0.43 + (palmSize - neutralSize) * 4.5, 0.22, 1.25),
    z: clamp((wrist.y - 0.55) * 5.5 + 0.35, -1.15, 1.6),
  };
}
