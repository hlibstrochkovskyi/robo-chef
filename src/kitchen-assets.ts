import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Interaction } from "./interaction";

const surface = (color: number, roughness = 0.6, metalness = 0) =>
  new T.MeshStandardMaterial({ color, roughness, metalness });
function box(
  parent: T.Object3D,
  size: number[],
  position: number[],
  material: T.Material,
  radius = 0.025,
) {
  const mesh = new T.Mesh(
    new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius),
    material,
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function lathe(profile: number[][], material: T.Material, segments = 64) {
  const mesh = new T.Mesh(
    new T.LatheGeometry(
      profile.map(([x, y]) => new T.Vector2(x, y)),
      segments,
    ),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function bar(
  parent: T.Object3D,
  start: T.Vector3,
  end: T.Vector3,
  radius: number,
  material: T.Material,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radius, radius, start.distanceTo(end), 12),
    material,
  );
  mesh.position.copy(start).lerp(end, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    end.clone().sub(start).normalize(),
  );
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function texture(kind: "wood" | "stone") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(512, 512);
  let seed = 42;
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 512; x++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise = seed / 4294967296 - 0.5;
      const grain =
        kind === "wood"
          ? Math.sin(y * 1.4 + Math.sin(x * 0.011) * 0.5) * 2 +
            Math.sin(y * 0.047 + Math.sin(x * 0.005)) * 2 +
            noise * 6
          : noise * 8;
      const color = kind === "wood" ? [145, 105, 68] : [207, 204, 196];
      const index = (y * 512 + x) * 4;
      for (let c = 0; c < 3; c++) image.data[index + c] = color[c] + grain;
      image.data[index + 3] = 255;
    }
  context.putImageData(image, 0, 0);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}
function cuttingBoard(material: T.Material) {
  const shape = new T.Shape();
  shape.moveTo(-0.83, -0.71);
  shape.lineTo(-0.18, -0.71);
  shape.lineTo(-0.18, -1.01);
  shape.quadraticCurveTo(-0.18, -1.18, 0, -1.18);
  shape.quadraticCurveTo(0.18, -1.18, 0.18, -1.01);
  shape.lineTo(0.18, -0.71);
  shape.lineTo(0.83, -0.71);
  shape.quadraticCurveTo(0.97, -0.71, 0.97, -0.57);
  shape.lineTo(0.97, 0.57);
  shape.quadraticCurveTo(0.97, 0.71, 0.83, 0.71);
  shape.lineTo(-0.83, 0.71);
  shape.quadraticCurveTo(-0.97, 0.71, -0.97, 0.57);
  shape.lineTo(-0.97, -0.57);
  shape.quadraticCurveTo(-0.97, -0.71, -0.83, -0.71);
  const hole = new T.Path();
  hole.absarc(0, -1.01, 0.066, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const mesh = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      curveSegments: 24,
    }),
    material,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(1.3, 0.018, -0.35);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildKitchen(scene: T.Scene, interaction: Interaction) {
  const objects = new Map<string, T.Group>();
  const steel = surface(0xb9bfc1, 0.3, 0.85),
    graphite = surface(0x292d30, 0.47, 0.35);
  const counter = surface(0xffffff, 0.76);
  counter.map = texture("stone");
  counter.map.repeat.set(2, 1.4);
  box(scene, [7, 0.13, 4.7], [0, -0.075, 0], surface(0xa89e8e), 0.035);
  box(scene, [6.97, 0.025, 4.67], [0, 0.002, 0], counter, 0.018);
  const cabinets = surface(0x626667, 0.75);
  box(scene, [7, 1.4, 4.35], [0, -0.84, 0], cabinets);
  for (let x = -2.8; x <= 2.8; x += 1.4) {
    box(scene, [1.37, 1.15, 0.035], [x, -0.82, 2.2], surface(0x777b79));
    box(scene, [0.34, 0.025, 0.035], [x, -0.3, 2.235], steel, 0.009);
  }
  box(scene, [12, 5, 0.12], [0, 1.4, -2.8], surface(0xd3d3cc, 0.9));
  const grout = surface(0xc5c7c0, 0.9);
  for (let x = -5.6; x <= 5.6; x += 1.05)
    box(scene, [0.006, 3, 0.006], [x, 1.4, -2.735], grout, 0.001);
  for (let y = 0.5; y < 3; y += 0.55)
    box(scene, [12, 0.006, 0.006], [0, y, -2.735], grout, 0.001);
  box(scene, [7, 0.035, 0.12], [0, 0.02, -2.27], steel, 0.008);

  const glass = surface(0x24292b, 0.23, 0.35);
  box(scene, [1.55, 0.034, 1.48], [-2, 0.033, -1.13], glass, 0.035);
  for (const x of [-2.36, -1.65]) {
    const ring = new T.Mesh(
      new T.TorusGeometry(0.255, 0.006, 8, 64),
      surface(0x7a8385, 0.4, 0.6),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.053, -1.15);
    scene.add(ring);
  }
  const pan = lathe(
    [
      [0, 0.025],
      [0.31, 0.025],
      [0.35, 0.04],
      [0.395, 0.14],
      [0.397, 0.16],
      [0.38, 0.16],
      [0.335, 0.06],
      [0, 0.06],
    ],
    surface(0x2e3233, 0.57, 0.6),
  );
  pan.position.set(-2.05, 0.055, -1.15);
  scene.add(pan);
  box(scene, [0.16, 0.035, 0.095], [-1.61, 0.16, -1.15], steel, 0.01);
  box(scene, [0.55, 0.055, 0.105], [-1.29, 0.16, -1.15], graphite, 0.035);
  const boardMaterial = surface(0xffffff, 0.65);
  boardMaterial.map = texture("wood");
  scene.add(cuttingBoard(boardMaterial));

  const crock = lathe(
    [
      [0, 0],
      [0.17, 0],
      [0.205, 0.03],
      [0.22, 0.36],
      [0.215, 0.39],
      [0.19, 0.39],
      [0.185, 0.055],
      [0, 0.055],
    ],
    surface(0xd8d6cd, 0.58),
  );
  crock.position.set(2.6, 0.015, -1.85);
  scene.add(crock);
  const spoonEnd = new T.Vector3(2.47, 0.92, -1.86);
  bar(scene, new T.Vector3(2.55, 0.23, -1.85), spoonEnd, 0.017, steel);
  const spoon = new T.Mesh(new T.SphereGeometry(1, 24, 16), steel);
  spoon.scale.set(0.065, 0.1, 0.015);
  spoon.position.copy(spoonEnd);
  spoon.rotation.z = -0.17;
  scene.add(spoon);
  bar(
    scene,
    new T.Vector3(2.65, 0.22, -1.84),
    new T.Vector3(2.77, 0.86, -1.82),
    0.02,
    graphite,
  );
  const spatula = box(
    scene,
    [0.11, 0.18, 0.025],
    [2.79, 0.93, -1.82],
    graphite,
    0.015,
  );
  spatula.rotation.z = -0.17;
  const jar = lathe(
    [
      [0, 0],
      [0.16, 0],
      [0.185, 0.03],
      [0.185, 0.32],
      [0.16, 0.35],
      [0.16, 0.38],
      [0, 0.38],
    ],
    surface(0xc5baa3, 0.48),
  );
  jar.position.set(-2.75, 0.015, -2.05);
  scene.add(jar);
  const lid = new T.Mesh(
    new T.CylinderGeometry(0.19, 0.19, 0.035, 48),
    surface(0x887c64, 0.65),
  );
  lid.position.set(-2.75, 0.41, -2.05);
  lid.castShadow = true;
  scene.add(lid);

  const mug = new T.Group();
  const ceramic = surface(0xb56c42, 0.22);
  const body = lathe(
    [
      [0, -0.22],
      [0.16, -0.22],
      [0.183, -0.205],
      [0.217, 0.19],
      [0.218, 0.212],
      [0.212, 0.222],
      [0.202, 0.223],
      [0.193, 0.21],
      [0.17, -0.16],
      [0.15, -0.18],
      [0, -0.18],
    ],
    ceramic,
  );
  mug.add(body);

  const handle = new T.Mesh(new T.TorusGeometry(0.14, 0.033, 16, 56), ceramic);
  handle.scale.y = 1.16;
  handle.position.set(0.248, 0.015, 0);
  handle.castShadow = true;
  mug.add(handle);
  scene.add(mug);
  objects.set("mug", mug);
  interaction.add("mug", { x: -0.65, y: 0.24, z: 0.25 }, 0.23);

  const tomato = new T.Group();
  const fruitGeometry = new T.SphereGeometry(0.18, 40, 28);
  const vertices = fruitGeometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      y = vertices.getY(i),
      z = vertices.getZ(i);
    const lobe = 1 + Math.cos(Math.atan2(z, x) * 5) * 0.025;
    vertices.setXYZ(i, x * lobe, y * 0.88, z * lobe);
  }
  fruitGeometry.computeVertexNormals();
  const fruit = new T.Mesh(fruitGeometry, surface(0xb93325, 0.34));
  fruit.castShadow = true;
  tomato.add(fruit);
  const leafShape = new T.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.04, 0.045, 0, 0.14);
  leafShape.quadraticCurveTo(-0.04, 0.045, 0, 0);
  const leafMaterial = surface(0x486044, 0.76);
  leafMaterial.side = T.DoubleSide;
  for (let i = 0; i < 5; i++) {
    const leaf = new T.Mesh(new T.ShapeGeometry(leafShape), leafMaterial);
    leaf.rotation.x = -Math.PI / 2;
    leaf.rotation.z = (i * Math.PI * 2) / 5;
    const pivot = new T.Group();
    pivot.rotation.y = (i * Math.PI * 2) / 5;
    leaf.rotation.z = 0;
    pivot.add(leaf);
    pivot.position.y = 0.147;
    tomato.add(pivot);
  }
  bar(
    tomato,
    new T.Vector3(0, 0.145, 0),
    new T.Vector3(0.015, 0.2, 0),
    0.009,
    leafMaterial,
  );
  scene.add(tomato);
  objects.set("tomato", tomato);
  interaction.add("tomato", { x: 0.2, y: 0.17, z: -0.8 }, 0.18);

  const egg = new T.Group();
  const eggGeometry = new T.SphereGeometry(0.13, 36, 28);
  const eggVertices = eggGeometry.getAttribute("position");
  for (let i = 0; i < eggVertices.count; i++) {
    const y = eggVertices.getY(i);
    const taper = 1 - (y / 0.13) * 0.16;
    eggVertices.setXYZ(
      i,
      eggVertices.getX(i) * taper,
      y * 1.34,
      eggVertices.getZ(i) * taper,
    );
  }
  eggGeometry.computeVertexNormals();
  const shell = new T.Mesh(eggGeometry, surface(0xd5c1a3, 0.64));
  shell.castShadow = true;
  shell.rotation.z = 0.18;
  egg.add(shell);
  scene.add(egg);
  objects.set("egg", egg);
  interaction.add("egg", { x: -0.3, y: 0.18, z: -1.1 }, 0.14);
  return objects;
}
