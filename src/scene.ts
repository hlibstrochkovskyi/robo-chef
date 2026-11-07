import * as T from "three";
import { type Point, type Side, clamp } from "./hand-input";
import { Interaction } from "./interaction";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildKitchen } from "./kitchen-assets";
import { RobotHand } from "./robot-hand";

const V = (p: Point) => new T.Vector3(p.x, p.y, p.z);
const up = new T.Vector3(0, 1, 0);
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
    this.renderer.toneMapping = T.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
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
    this.scene.environmentIntensity = 0.7;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new T.HemisphereLight(0xf4f6fa, 0x8b8174, 0.28));
    const sun = new T.DirectionalLight(0xfff7ec, 2.5);
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
      x > 0.35 && x < 2.25 && z > -1.075 && z < 0.375 ? 0.0655 : 0;
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
            const materials = Array.isArray(o.material)
              ? o.material
              : [o.material];
            for (const material of materials) {
              if (material instanceof T.MeshStandardMaterial) {
                material.emissive.setHex(highlighted ? 0x513317 : 0);
                material.emissiveIntensity = 0.18;
              }
            }
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
