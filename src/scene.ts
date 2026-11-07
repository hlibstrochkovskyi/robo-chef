import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  CONNECTIONS,
  type Point,
  type Side,
  type HandInput,
  clamp,
} from "./hand-input";
import { Interaction } from "./interaction";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildKitchen } from "./kitchen-assets";

const V = (p: Point) => new T.Vector3(p.x, p.y, p.z);
const up = new T.Vector3(0, 1, 0);
const material = (color: number, metalness = 0, roughness = 0.6) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
const white = material(0xc9cdd0, 0.65, 0.38),
  joint = material(0x30373c, 0.65, 0.38),
  accent = material(0x55616b, 0.65, 0.32);
const defaults = (side: Side, grip = false) => {
  const s = side === "Left" ? -1 : 1;
  const p: T.Vector3[] = [new T.Vector3(0, 0, 0.25)];
  for (let finger = 0; finger < 5; finger++)
    for (let k = 0; k < 4; k++) {
      if (finger === 0)
        p.push(
          new T.Vector3(
            s * (-0.22 - k * 0.055),
            grip ? 0.03 + k * 0.035 : 0,
            0.11 - k * 0.065,
          ),
        );
      else
        p.push(
          new T.Vector3(
            s * ((finger - 1) * 0.115 - 0.17),
            grip ? 0.04 + Math.sin((k / 3) * Math.PI) * 0.17 : 0.01,
            -0.03 - k * (finger === 4 ? 0.085 : 0.105) + (grip ? k * 0.08 : 0),
          ),
        );
    }
  return p;
};

class RobotHand {
  group = new T.Group();
  points: T.Vector3[];
  targets: T.Vector3[];
  bones: T.Mesh[] = [];
  joints: T.Mesh[] = [];
  palm: T.Mesh;
  cuff: T.Mesh;
  arm: T.Group;
  position: T.Vector3;
  target: T.Vector3;
  lastSeen = 0;
  active = false;
  constructor(
    public side: Side,
    scene: T.Scene,
  ) {
    this.points = defaults(side);
    this.targets = defaults(side);
    this.position = new T.Vector3(side === "Left" ? -1.45 : 1.45, 0.65, 1.35);
    this.target = this.position.clone();
    for (const _ of CONNECTIONS) {
      const bone = new T.Mesh(
        new T.CylinderGeometry(0.034, 0.04, 1, 12),
        white,
      );
      bone.castShadow = true;
      this.group.add(bone);
      this.bones.push(bone);
    }
    for (let i = 0; i < 21; i++) {
      const dot = new T.Mesh(
        new T.SphereGeometry(i === 0 ? 0.07 : 0.043, 16, 12),
        joint,
      );
      this.group.add(dot);
      this.joints.push(dot);
    }
    this.palm = new T.Mesh(
      new RoundedBoxGeometry(0.38, 0.105, 0.3, 2, 0.04),
      white,
    );
    this.palm.castShadow = true;
    this.group.add(this.palm);
    const inset = new T.Mesh(
      new RoundedBoxGeometry(0.23, 0.015, 0.15, 2, 0.015),
      accent,
    );
    inset.position.set(0, 0.059, 0);
    this.palm.add(inset);
    this.cuff = new T.Mesh(
      new T.CylinderGeometry(0.12, 0.13, 0.15, 16),
      accent,
    );
    this.group.add(this.cuff);
    this.arm = new T.Group();
    const core = new T.Mesh(new T.CylinderGeometry(0.075, 0.09, 1, 16), joint);
    const shell = new T.Mesh(
      new RoundedBoxGeometry(0.185, 0.76, 0.17, 3, 0.045),
      white,
    );
    const wristRing = new T.Mesh(
      new T.CylinderGeometry(0.1, 0.1, 0.08, 24),
      accent,
    );
    wristRing.position.y = 0.44;
    const elbowRing = wristRing.clone();
    elbowRing.position.y = -0.44;
    this.arm.add(core, shell, wristRing, elbowRing);
    this.arm.traverse((object) => {
      if (object instanceof T.Mesh) object.castShadow = true;
    });
    scene.add(this.arm);
    scene.add(this.group);
  }
  pose(input: HandInput) {
    const points = input.world.length === 21 ? input.world : input.landmarks;
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
    this.targets = defaults(this.side, grip);
  }
  update(dt: number) {
    const a = 1 - Math.exp(-18 * dt);
    this.position.lerp(this.target, a);
    this.group.position.copy(this.position);
    this.points.forEach((p, i) => p.lerp(this.targets[i], a));
    CONNECTIONS.forEach(([a, b], i) => {
      const start = this.points[a],
        end = this.points[b],
        m = this.bones[i];
      m.position.copy(start).lerp(end, 0.5);
      m.scale.y = start.distanceTo(end);
      m.quaternion.setFromUnitVectors(up, end.clone().sub(start).normalize());
    });
    this.joints.forEach((m, i) => m.position.copy(this.points[i]));
    const wrist = this.points[0],
      middle = this.points[9];
    this.palm.position.copy(wrist).lerp(middle, 0.53);
    const z = wrist.clone().sub(middle).normalize(),
      x = this.points[17].clone().sub(this.points[5]).normalize(),
      y = z.clone().cross(x).normalize();
    x.copy(y).cross(z).normalize();
    this.palm.quaternion.setFromRotationMatrix(
      new T.Matrix4().makeBasis(x, y, z),
    );
    this.cuff.position.copy(wrist);
    this.cuff.quaternion.setFromUnitVectors(up, z);
    const end = wrist.clone().add(this.position),
      start = new T.Vector3(this.side === "Left" ? -1.5 : 1.5, 0.2, 2.85);
    this.arm.position.copy(start).lerp(end, 0.5);
    this.arm.scale.y = start.distanceTo(end);
    this.arm.quaternion.setFromUnitVectors(up, end.sub(start).normalize());
  }
}

export class Kitchen {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(46, 1, 0.1, 70);
  interaction = new Interaction();
  hands: Record<Side, RobotHand>;
  meshes = new Map<string, T.Group>();
  pointer = new T.Vector2();
  raycaster = new T.Raycaster();
  onFrame: () => void = () => {};
  paused = false;
  mode: "mouse" | "camera" = "mouse";
  mouseGrip = false;
  activeSide: Side = "Right";
  private last = 0;
  private resizeObserver: ResizeObserver;
  constructor(public container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.VSMShadowMap;
    this.renderer.setClearColor(0xd3d3cd);
    this.renderer.toneMapping = T.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Virtual kitchen. Move the mouse and hold the primary button to carry objects.",
    );
    this.camera.position.set(0, 3.8, 4.6);
    this.camera.lookAt(0, 0.1, 0.15);
    const room = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.8;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new T.HemisphereLight(0xf4f6fa, 0x8b8174, 0.55));
    const sun = new T.DirectionalLight(0xfff7ec, 3.0);
    sun.position.set(-3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    sun.shadow.bias = -0.00008;
    sun.shadow.normalBias = 0.005;
    sun.shadow.radius = 3;
    sun.shadow.blurSamples = 8;
    this.scene.add(sun);
    this.meshes = buildKitchen(this.scene, this.interaction);
    this.interaction.surfaceHeight = (x, z) =>
      x > 0.35 && x < 2.25 && z > -1.075 && z < 0.375 ? 0.073 : 0;
    this.hands = {
      Left: new RobotHand("Left", this.scene),
      Right: new RobotHand("Right", this.scene),
    };
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerdown", (e) => {
      if (this.mode !== "mouse" || this.paused || e.button !== 0) return;
      this.move(e);
      this.mouseGrip = true;
      canvas.setPointerCapture(e.pointerId);
    });
    const release = () => {
      this.mouseGrip = false;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    this.renderer.setAnimationLoop((t) => this.animate(t));
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(width, height);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
  move(e: PointerEvent) {
    if (this.mode !== "mouse" || this.paused) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = new T.Vector3();
    if (this.raycaster.ray.intersectPlane(new T.Plane(up, -0.36), hit))
      this.hands[this.activeSide].target.set(
        clamp(hit.x, -2.6, 2.6),
        0.36,
        clamp(hit.z, -1.4, 1.7),
      );
  }
  setMode(mode: "mouse" | "camera") {
    this.interaction.release("Left");
    this.interaction.release("Right");
    this.mouseGrip = false;
    this.mode = mode;
  }
  reset() {
    this.interaction.reset();
    this.mouseGrip = false;
  }
  animate(time: number) {
    const dt = Math.min((time - this.last) / 1000, 0.04);
    this.last = time;
    if (!this.paused) {
      this.onFrame();
      for (const side of ["Left", "Right"] as Side[]) {
        const hand = this.hands[side];
        if (this.mode === "mouse") {
          const grip = side === this.activeSide && this.mouseGrip;
          hand.demo(grip);
          hand.update(dt);
          this.interaction.updateHand(side, hand.target, grip);
        } else {
          hand.update(dt);
          if (time - hand.lastSeen > 650) {
            this.interaction.release(side);
            hand.active = false;
          }
        }
      }
      this.interaction.tick(dt);
      for (const item of this.interaction.items) {
        const mesh = this.meshes.get(item.id)!;
        mesh.position.copy(V(item.position));
        mesh.rotation.y = item.rotation;
        const highlighted =
          Object.values(this.interaction.hover).includes(item.id) ||
          !!item.heldBy;
        mesh.traverse((o) => {
          if (o instanceof T.Mesh) {
            const m = o.material as T.MeshStandardMaterial;
            m.emissive.setHex(highlighted ? 0x513317 : 0);
            m.emissiveIntensity = 0.18;
          }
        });
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
  project(point: Point) {
    const p = V(point).project(this.camera),
      r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) / 2) * r.width,
      y: r.top + ((1 - p.y) / 2) * r.height,
    };
  }
}
