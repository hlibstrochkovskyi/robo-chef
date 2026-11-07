import { mkdir, cp, writeFile, access } from "node:fs/promises";
await mkdir("public/mediapipe", { recursive: true });
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe", {
  recursive: true,
});
await mkdir("public/models", { recursive: true });
const path = "public/models/hand_landmarker.task";
try {
  await access(path);
  console.log("Model already downloaded.");
} catch {
  console.log("Downloading the MediaPipe hand model…");
  const response = await fetch(
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  );
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}
console.log("Ready. Model and WASM assets are served locally.");
