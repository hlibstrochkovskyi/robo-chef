import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { HandInput, Side } from "./hand-input";

const axisY = new T.Vector3(0, 1, 0);
const paint = new T.MeshStandardMaterial({
  color: 0xd6d9d7,
  metalness: 0.22,
  roughness: 0.34,
});
const alloy = new T.MeshStandardMaterial({
  color: 0x9ca8b1,
  metalness: 0.92,
  roughness: 0.29,
});
const dark = new T.MeshStandardMaterial({
  color: 0x303943,
  metalness: 0.58,
  roughness: 0.34,
});
const rubber = new T.MeshStandardMaterial({
  color: 0x242a2e,
  metalness: 0,
  roughness: 0.83,
});
const digitCase = new RoundedBoxGeometry(0.078, 1, 0.066, 3, 0.022);
const digitPad = new RoundedBoxGeometry(0.058, 1, 0.012, 2, 0.005);
const axle = new T.CylinderGeometry(0.034, 0.034, 0.088, 20);
const axleCap = new T.CylinderGeometry(0.023, 0.023, 0.007, 16);
const screw = new T.CylinderGeometry(0.01, 0.01, 0.005, 12);

export function restPose(side: Side, grip = false) {
  const sign = side === "Left" ? -1 : 1;
  const points = [new T.Vector3(0, 0, 0.25)];
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
  return points;
}
function mesh(
  geometry: T.BufferGeometry,
  material: T.Material,
  parent: T.Object3D,
) {
  const part = new T.Mesh(geometry, material);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}
function housing(
  parent: T.Object3D,
  dimensions: number[],
  material: T.Material,
  position: number[],
  radius = 0.02,
) {
  const part = mesh(
    new RoundedBoxGeometry(
      dimensions[0],
      dimensions[1],
      dimensions[2],
      3,
      radius,
    ),
    material,
    parent,
  );
  part.position.set(position[0], position[1], position[2]);
  return part;
}
interface Phalanx {
  start: number;
  end: number;
  root: T.Group;
  body: T.Mesh;
  pad: T.Mesh;
  hinge: T.Group;
}

export class RobotHand {
  group = new T.Group();
  palm = new T.Group();
  wrist = new T.Group();
  arm = new T.Group();
  points: T.Vector3[];
  targets: T.Vector3[];
  position: T.Vector3;
  target: T.Vector3;
  lastSeen = 0;
  active = false;
  private digits: Phalanx[] = [];
  private x = new T.Vector3();
  private y = new T.Vector3();
  private z = new T.Vector3();
  private direction = new T.Vector3();
  private boneX = new T.Vector3();
  private boneZ = new T.Vector3();
  private basis = new T.Matrix4();
  constructor(
    public side: Side,
    scene: T.Scene,
  ) {
    this.group.name = `${side} robot hand`;
    this.points = restPose(side);
    this.targets = restPose(side);
    this.position = new T.Vector3(side === "Left" ? -1.45 : 1.45, 0.65, 1.35);
    this.target = this.position.clone();
    this.buildPalm();
    this.group.add(this.palm, this.wrist);
    for (const base of [1, 5, 9, 13, 17])
      for (let index = 0; index < 3; index++) {
        const root = new T.Group();
        const body = mesh(digitCase, paint, root);
        const pad = mesh(digitPad, rubber, root);
        pad.position.z = -0.038;
        const hinge = new T.Group();
        const shaft = mesh(axle, dark, hinge);
        shaft.rotation.z = Math.PI / 2;
        for (const sign of [-1, 1]) {
          const cap = mesh(axleCap, alloy, hinge);
          cap.rotation.z = Math.PI / 2;
          cap.position.x = sign * 0.047;
        }
        root.add(hinge);
        this.group.add(root);
        if (base === 1) root.scale.x = 1.1;
        if (base === 17) root.scale.x = 0.87;
        this.digits.push({
          start: base + index,
          end: base + index + 1,
          root,
          body,
          pad,
          hinge,
        });
      }
    this.buildWrist();
    this.buildArm();
    scene.add(this.group, this.arm);
    this.update(1);
  }
  private buildPalm() {
    housing(this.palm, [0.375, 0.075, 0.3], rubber, [0, -0.014, 0], 0.035);
    housing(this.palm, [0.355, 0.065, 0.283], paint, [0, 0.027, 0], 0.043);
    housing(this.palm, [0.22, 0.014, 0.167], alloy, [0, 0.065, -0.01], 0.018);
    for (const x of [-0.135, 0.135])
      for (const z of [-0.09, 0.09])
        mesh(screw, alloy, this.palm).position.set(x, 0.063, z);
    for (let i = 0; i < 3; i++)
      housing(
        this.palm,
        [0.09, 0.003, 0.009],
        dark,
        [0, 0.074, 0.015 + i * 0.021],
        0.003,
      );
    housing(this.palm, [0.11, 0.02, 0.025], dark, [0, 0.059, -0.125], 0.009);
  }
  private buildWrist() {
    const ball = mesh(new T.SphereGeometry(0.086, 24, 16), alloy, this.wrist);
    ball.scale.set(1, 0.85, 1);
    const collar = mesh(
      new T.CylinderGeometry(0.108, 0.115, 0.12, 32),
      dark,
      this.wrist,
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.z = 0.06;
    for (const z of [0.015, 0.1]) {
      const ring = mesh(
        new T.TorusGeometry(0.107, 0.009, 10, 32),
        alloy,
        this.wrist,
      );
      ring.position.z = z;
    }
  }
  private buildArm() {
    mesh(new T.CylinderGeometry(0.075, 0.09, 1, 24), alloy, this.arm);
    const casing = mesh(
      new T.CylinderGeometry(0.1, 0.125, 0.76, 32),
      paint,
      this.arm,
    );
    casing.position.y = -0.01;
    housing(this.arm, [0.085, 0.53, 0.027], dark, [0, -0.015, 0.112], 0.012);
    for (const y of [-0.41, 0.4]) {
      const collar = mesh(
        new T.CylinderGeometry(
          y < 0 ? 0.126 : 0.102,
          y < 0 ? 0.126 : 0.102,
          0.055,
          32,
        ),
        dark,
        this.arm,
      );
      collar.position.y = y;
    }
    for (const y of [-0.34, 0.32])
      mesh(screw, alloy, this.arm).position.set(0, y, 0.108);
  }
  pose(input: HandInput) {
    const points = input.world.length === 21 ? input.world : input.landmarks;
    if (points.length !== 21) return;
    const center = points[9];
    this.targets = points.map(
      (p) =>
        new T.Vector3(
          -(p.x - center.x) * 3.5,
          -(p.z - center.z) * 3.5,
          (p.y - center.y) * 3.5,
        ),
    );
  }
  demo(grip: boolean) {
    this.targets = restPose(this.side, grip);
  }
  update(dt: number) {
    const alpha = 1 - Math.exp(-18 * dt);
    this.position.lerp(this.target, alpha);
    this.group.position.copy(this.position);
    this.points.forEach((p, index) => p.lerp(this.targets[index], alpha));
    const wrist = this.points[0],
      middle = this.points[9];
    this.z.copy(wrist).sub(middle);
    if (this.z.lengthSq() < 1e-8) this.z.set(0, 0, 1);
    else this.z.normalize();
    this.x.copy(this.points[17]).sub(this.points[5]);
    // Keep the dorsal normal consistent across mirrored left/right landmarks.
    if (this.side === "Left") this.x.negate();
    this.y.crossVectors(this.z, this.x);
    if (this.y.lengthSq() < 1e-8) this.y.set(0, 1, 0);
    else this.y.normalize();
    this.x.crossVectors(this.y, this.z).normalize();
    this.basis.makeBasis(this.x, this.y, this.z);
    this.palm.position.copy(wrist).lerp(middle, 0.53);
    this.palm.quaternion.setFromRotationMatrix(this.basis);
    this.wrist.position.copy(wrist);
    this.wrist.quaternion.copy(this.palm.quaternion);
    for (const digit of this.digits) {
      const start = this.points[digit.start],
        end = this.points[digit.end];
      const length = Math.max(start.distanceTo(end), 0.018);
      this.direction.copy(end).sub(start);
      if (this.direction.lengthSq() < 1e-8)
        this.direction.copy(this.z).negate();
      else this.direction.normalize();
      this.boneX
        .copy(this.x)
        .addScaledVector(this.direction, -this.x.dot(this.direction));
      if (this.boneX.lengthSq() < 1e-8)
        this.boneX
          .copy(this.y)
          .addScaledVector(this.direction, -this.y.dot(this.direction));
      this.boneX.normalize();
      this.boneZ.crossVectors(this.boneX, this.direction).normalize();
      digit.root.position.copy(start).lerp(end, 0.5);
      digit.root.quaternion.setFromRotationMatrix(
        this.basis.makeBasis(this.boneX, this.direction, this.boneZ),
      );
      digit.body.scale.y = length * 0.69;
      digit.pad.scale.y = length * 0.66;
      digit.hinge.position.y = -length * 0.5;
    }
    const armStart = new T.Vector3(
      this.side === "Left" ? -1.5 : 1.5,
      0.2,
      2.85,
    );
    const armEnd = wrist.clone().add(this.position);
    this.arm.position.copy(armStart).lerp(armEnd, 0.5);
    this.arm.scale.y = armStart.distanceTo(armEnd);
    this.arm.quaternion.setFromUnitVectors(
      axisY,
      armEnd.sub(armStart).normalize(),
    );
  }
}
