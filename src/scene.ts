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

const V = (p: Point) => new T.Vector3(p.x, p.y, p.z);
const up = new T.Vector3(0, 1, 0);
const material = (color: number, metalness = 0, roughness = 0.6) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
const white = material(0xe9eff2, 0.3, 0.32),
  joint = material(0x324957, 0.7, 0.28),
  accent = material(0x738460, 0.5, 0.32);
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
  arm: T.Mesh;
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
        new T.CylinderGeometry(0.036, 0.041, 1, 8),
        white,
      );
      bone.castShadow = true;
      this.group.add(bone);
      this.bones.push(bone);
    }
    for (let i = 0; i < 21; i++) {
      const dot = new T.Mesh(
        new T.SphereGeometry(i === 0 ? 0.07 : 0.045, 10, 8),
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
    this.arm = new T.Mesh(new T.CylinderGeometry(0.11, 0.15, 1, 12), white);
    this.arm.castShadow = true;
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
      start = new T.Vector3(this.side === "Left" ? -1.65 : 1.65, -0.55, 3.05);
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
  target = new T.Vector3(1.3, 0.01, -0.35);
  onFrame: () => void = () => {};
  onProgress: (done: boolean) => void = () => {};
  paused = false;
  mode: "mouse" | "camera" = "mouse";
  mouseGrip = false;
  activeSide: Side = "Right";
  private last = 0;
  private complete = false;
  private resizeObserver: ResizeObserver;
  constructor(public container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.setClearColor(0xd5d9cc);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.prepend(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Virtual kitchen. Move the mouse and hold the primary button to carry objects.",
    );
    this.camera.position.set(0, 4.45, 5.7);
    this.camera.lookAt(0, 0.15, -0.3);
    this.scene.add(new T.HemisphereLight(0xf6fbff, 0x8d9b96, 3));
    const sun = new T.DirectionalLight(0xfff4df, 4);
    sun.position.set(-3, 7, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
    this.buildRoom();
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
  box(
    w: number,
    h: number,
    d: number,
    color: number,
    x: number,
    y: number,
    z: number,
    r = 0.025,
    parent: T.Object3D = this.scene,
  ) {
    const mesh = new T.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, r),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  buildRoom() {
    this.box(7, 0.16, 4.7, 0xd9c6a5, 0, -0.09, 0);
    // Light oak strips give the worktop a little grain without external textures.
    for (let i = 0; i < 28; i++)
      this.box(
        6.96,
        0.002,
        0.006,
        i % 3 === 0 ? 0xbda47d : 0xcdb68f,
        0,
        0.001,
        -2.25 + i * 0.165,
        0.001,
      );
    this.box(7, 1.4, 4.4, 0x65725d, 0, -0.86, 0);
    for (let x = -2.8; x <= 2.8; x += 1.4) {
      this.box(1.34, 1.15, 0.045, 0x87937b, x, -0.82, 2.23);
      this.box(0.34, 0.035, 0.07, 0xc6d0cb, x, -0.38, 2.28);
    }
    this.box(11, 5, 0.15, 0xdce0d5, 0, 1.4, -2.8);
    for (let x = -5; x <= 5; x += 0.55)
      this.box(0.008, 2.8, 0.01, 0xc4ccba, x, 1.25, -2.71, 0.001);
    for (let y = 0; y < 3; y += 0.3)
      this.box(10, 0.008, 0.01, 0xc4ccba, 0, y, -2.71, 0.001);
    this.box(2.3, 0.1, 0.55, 0xa88961, -1.8, 1.65, -2.42);
    for (let i = 0; i < 3; i++) {
      const jar = new T.Mesh(
        new T.CylinderGeometry(0.12, 0.12, 0.27, 20),
        material([0xbcc8b9, 0xd9a774, 0xf0eee2][i]),
      );
      jar.position.set(-2.35 + i * 0.44, 1.83, -2.4);
      jar.castShadow = true;
      this.scene.add(jar);
      this.box(0.25, 0.045, 0.25, 0x87745f, -2.35 + i * 0.44, 1.99, -2.4);
    }
    this.box(1.5, 0.055, 1.5, 0x283e49, -2, 0.04, -1.13);
    for (const x of [-2.35, -1.65]) {
      const ring = new T.Mesh(
        new T.TorusGeometry(0.25, 0.009, 8, 48),
        material(0x728b91),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.075, -1.17);
      this.scene.add(ring);
    }
    const pan = new T.Mesh(
      new T.CylinderGeometry(0.36, 0.3, 0.1, 40),
      material(0x384b53, 0.6),
    );
    pan.position.set(-2.05, 0.14, -1.15);
    this.scene.add(pan);
    this.box(0.55, 0.055, 0.12, 0x263943, -1.49, 0.16, -1.15);
    this.box(1.9, 0.055, 1.45, 0xb99260, 1.3, 0.045, -0.35, 0.1);
    this.box(0.28, 0.065, 0.6, 0xb99260, 1.3, 0.045, 0.54, 0.08);
    const targetRing = new T.Mesh(
      new T.TorusGeometry(0.4, 0.013, 8, 64),
      material(0xeaf6e5),
    );
    targetRing.rotation.x = -Math.PI / 2;
    targetRing.position.copy(this.target).setY(0.08);
    this.scene.add(targetRing);
    const pot = new T.Mesh(
      new T.CylinderGeometry(0.22, 0.16, 0.38, 24),
      material(0xe9e4d6),
    );
    pot.position.set(2.6, 0.19, -1.8);
    this.scene.add(pot);
    for (let i = 0; i < 9; i++) {
      const leaf = new T.Mesh(
        new T.SphereGeometry(1, 12, 10),
        material(i % 2 ? 0x668c54 : 0x8ba967),
      );
      leaf.scale.set(0.1, 0.32, 0.07);
      leaf.position.set(
        2.6 + Math.sin(i * 2.4) * 0.17,
        0.48 + Math.cos(i * 3) * 0.1,
        -1.8 + Math.cos(i * 2.4) * 0.13,
      );
      leaf.rotation.z = Math.sin(i * 2.4) * 0.65;
      this.scene.add(leaf);
    }
    const mug = new T.Group();
    const ceramic = material(0xe58a51, 0.05, 0.3);
    const body = new T.Mesh(
      new T.CylinderGeometry(0.22, 0.19, 0.44, 40, 1, true),
      ceramic,
    );
    mug.add(body);
    const bottom = new T.Mesh(
      new T.CylinderGeometry(0.19, 0.19, 0.035, 40),
      ceramic,
    );
    bottom.position.y = -0.2;
    mug.add(bottom);
    const inner = new T.Mesh(
      new T.CylinderGeometry(0.203, 0.175, 0.4, 40, 1, true),
      material(0xf4c6a1),
    );
    inner.material.side = T.BackSide;
    inner.position.y = 0.015;
    mug.add(inner);
    const lip = new T.Mesh(new T.TorusGeometry(0.211, 0.012, 10, 48), ceramic);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.22;
    mug.add(lip);
    const handle = new T.Mesh(
      new T.TorusGeometry(0.135, 0.035, 12, 32, Math.PI * 1.6),
      ceramic,
    );
    handle.position.x = 0.22;
    handle.rotation.z = -Math.PI * 0.8;
    mug.add(handle);
    mug.traverse((o) => {
      if (o instanceof T.Mesh) o.castShadow = true;
    });
    this.scene.add(mug);
    this.meshes.set("mug", mug);
    this.interaction.add("mug", { x: -0.65, y: 0.24, z: 0.25 }, 0.23);
    const tomato = new T.Group();
    const fruit = new T.Mesh(
      new T.SphereGeometry(0.18, 24, 20),
      material(0xd75d47, 0.05, 0.4),
    );
    fruit.scale.y = 0.85;
    tomato.add(fruit);
    for (let i = 0; i < 5; i++) {
      const leaf = new T.Mesh(
        new T.ConeGeometry(0.045, 0.15, 3),
        material(0x58734d),
      );
      leaf.rotation.z = Math.PI / 2;
      leaf.rotation.y = (i * Math.PI * 2) / 5;
      leaf.position.y = 0.15;
      tomato.add(leaf);
    }
    this.scene.add(tomato);
    this.meshes.set("tomato", tomato);
    this.interaction.add("tomato", { x: 0.2, y: 0.17, z: -0.8 }, 0.18);
    const egg = new T.Group();
    const shell = new T.Mesh(
      new T.SphereGeometry(0.13, 24, 20),
      material(0xe9ddc6),
    );
    shell.scale.y = 1.35;
    egg.add(shell);
    this.scene.add(egg);
    this.meshes.set("egg", egg);
    this.interaction.add("egg", { x: -0.3, y: 0.18, z: -1.1 }, 0.14);
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
    this.complete = false;
    this.onProgress(false);
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
      const mug = this.interaction.items.find((i) => i.id === "mug")!;
      const done =
        !mug.heldBy &&
        mug.position.y < 0.34 &&
        Math.hypot(
          mug.position.x - this.target.x,
          mug.position.z - this.target.z,
        ) < 0.37;
      if (done && !this.complete) {
        this.complete = true;
        this.onProgress(true);
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
