import * as T from "three";

function finish(object: T.Object3D) {
  object.traverse((part) => {
    if (part instanceof T.Mesh) {
      part.castShadow = true;
      part.receiveShadow = true;
    }
  });
  return object;
}
export function createMug() {
  const mug = new T.Group();
  mug.name = "Glazed ceramic cup";
  const glaze = new T.MeshPhysicalMaterial({
    color: 0xa9532d,
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
  });
  const lining = glaze.clone();
  lining.color.setHex(0xe4dbcd);
  const profile = new T.Path();
  profile.moveTo(0, -0.22);
  profile.lineTo(0.146, -0.22);
  profile.quadraticCurveTo(0.184, -0.22, 0.188, -0.192);
  profile.lineTo(0.217, 0.18);
  profile.quadraticCurveTo(0.224, 0.225, 0.205, 0.227);
  profile.quadraticCurveTo(0.189, 0.229, 0.189, 0.205);
  profile.lineTo(0.165, -0.155);
  profile.quadraticCurveTo(0.163, -0.181, 0.14, -0.181);
  profile.lineTo(0, -0.181);
  const points = profile.getPoints(10);
  const geometry = new T.LatheGeometry(points, 80);
  const inner = points.findIndex((p) => p.y > 0.222 && p.x <= 0.2051);
  const source = geometry.index!.array;
  const outside: number[] = [],
    inside: number[] = [];
  for (let i = 0; i < 80; i++)
    for (let j = 0; j < points.length - 1; j++) {
      const target = j >= inner ? inside : outside;
      const offset = (i * (points.length - 1) + j) * 6;
      for (let k = 0; k < 6; k++) target.push(source[offset + k]);
    }
  geometry.setIndex([...outside, ...inside]);
  geometry.clearGroups();
  geometry.addGroup(0, outside.length, 0);
  geometry.addGroup(outside.length, inside.length, 1);
  mug.add(new T.Mesh(geometry, [glaze, lining]));
  const handlePath = new T.CubicBezierCurve3(
    new T.Vector3(0.19, 0.145, 0),
    new T.Vector3(0.48, 0.23, 0),
    new T.Vector3(0.46, -0.23, 0),
    new T.Vector3(0.17, -0.14, 0),
  );
  mug.add(
    new T.Mesh(new T.TubeGeometry(handlePath, 48, 0.033, 14, false), glaze),
  );
  const foot = new T.Mesh(
    new T.TorusGeometry(0.146, 0.007, 8, 64),
    new T.MeshStandardMaterial({ color: 0xcdbb9e, roughness: 0.8 }),
  );
  foot.rotation.x = Math.PI / 2;
  foot.position.y = -0.22;
  mug.add(foot);
  finish(mug);
  return mug;
}
export function createTomato() {
  const tomato = new T.Group();
  tomato.name = "Tomato";
  const geometry = new T.SphereGeometry(0.18, 48, 32);
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const bright = new T.Color(0xbc2817),
    dark = new T.Color(0x8a2113);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const angle = Math.atan2(z, x),
      t = y / 0.18;
    const lobe = 1 + Math.cos(angle * 5) * 0.035 * (1 - t * t);
    const dimple = y > 0 ? 0.024 * Math.exp(-(x * x + z * z) / 0.003) : 0;
    positions.setXYZ(i, x * lobe, y * 0.88 - dimple, z * lobe);
    const variation = 0.15 + 0.2 * Math.sin(angle * 5 + t * 2) + 0.13 * t;
    const color = bright.clone().lerp(dark, Math.max(0, variation));
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const skin = new T.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.39,
    clearcoat: 0.32,
    clearcoatRoughness: 0.27,
  });
  tomato.add(new T.Mesh(geometry, skin));
  const leafMaterial = new T.MeshStandardMaterial({
    color: 0x345437,
    roughness: 0.8,
    side: T.DoubleSide,
  });
  for (let i = 0; i < 5; i++) {
    const shape = new T.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.013, 0.035, 0.036, 0.07, 0, 0.125);
    shape.bezierCurveTo(-0.012, 0.06, -0.027, 0.025, 0, 0);
    const leaf = new T.Mesh(new T.ShapeGeometry(shape, 12), leafMaterial);
    leaf.rotation.x = -Math.PI / 2 + 0.13;
    const pivot = new T.Group();
    pivot.rotation.y = (i * Math.PI * 2) / 5;
    pivot.position.y = 0.136;
    pivot.add(leaf);
    tomato.add(pivot);
  }
  const stem = new T.Mesh(
    new T.CylinderGeometry(0.005, 0.009, 0.046, 10),
    leafMaterial,
  );
  stem.position.set(0.004, 0.156, 0);
  stem.rotation.z = -0.16;
  tomato.add(stem);
  finish(tomato);
  return tomato;
}
export function createEgg() {
  const egg = new T.Group();
  egg.name = "Egg";
  const geometry = new T.SphereGeometry(0.13, 40, 32),
    positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i),
      taper = 1 - (y / 0.13) * 0.16;
    positions.setXYZ(
      i,
      positions.getX(i) * taper,
      y * 1.34,
      positions.getZ(i) * taper,
    );
  }
  geometry.computeVertexNormals();
  const size = 128,
    data = new Uint8Array(size * size * 4);
  let seed = 17;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = 192 + (seed >>> 28);
    data.set([v, v, v, 255], i * 4);
  }
  const pores = new T.DataTexture(data, size, size);
  pores.wrapS = pores.wrapT = T.RepeatWrapping;
  pores.needsUpdate = true;
  const material = new T.MeshStandardMaterial({
    color: 0xd4bc96,
    roughness: 0.82,
    bumpMap: pores,
    bumpScale: 0.0006,
  });
  const shell = new T.Mesh(geometry, material);
  shell.rotation.z = 0.18;
  egg.add(shell);
  finish(egg);
  return egg;
}
