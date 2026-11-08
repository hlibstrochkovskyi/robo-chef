import "./style.css";
import "@fontsource-variable/dm-sans";
import { Kitchen } from "./scene";
import { Tracking } from "./tracking";
import { icon, mountInterface } from "./interface";
import type { Side } from "./hand-input";

mountInterface();
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let kitchen: Kitchen;
try {
  kitchen = new Kitchen(el("scene"));
} catch {
  el("scene").innerHTML =
    '<div class="scene-error"><h2>Graphics unavailable</h2><p>Enable hardware acceleration and restart Robo Chef.</p></div>';
  for (const id of ["start", "pause", "reset", "fullscreen"])
    el<HTMLButtonElement>(id).disabled = true;
  throw new Error("WebGL is unavailable.");
}
const tracking = new Tracking(
  el<HTMLVideoElement>("video"),
  el<HTMLCanvasElement>("overlay"),
);
let toastTimer: ReturnType<typeof setTimeout>;
let cameraAttempt = 0;
let cameraStarting = false;
function toast(message: string) {
  el("toast").textContent = message;
  el("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el("toast").hidden = true), 2500);
}
function stopCamera() {
  cameraAttempt++;
  tracking.stop();
  cameraStarting = false;
  kitchen.setMode("mouse");
  el("camera-empty").hidden = false;
  el("camera-title").textContent = "Camera off";
  el("camera-live").hidden = true;
  el("hand-states").hidden = true;
  el("stop").hidden = true;
  el("start").hidden = false;
  el("camera-status").textContent = "Off";
  el("camera-status").classList.remove("live");
  el("tracking-note").textContent = "Mouse control";
  el("tracking-note").classList.remove("error");
  el("mouse-switch").hidden = false;
  el("calibrate").hidden = true;
  el<HTMLButtonElement>("calibrate").disabled = true;
}
async function startCamera() {
  if (cameraStarting || tracking.running) return;
  const attempt = ++cameraAttempt;
  cameraStarting = true;
  kitchen.setMode("camera");
  el("start").hidden = true;
  el("stop").hidden = false;
  el("stop").textContent = "Cancel";
  el("camera-status").textContent = "Connecting";
  el("camera-title").textContent = "Connecting…";
  el("tracking-note").classList.remove("error");
  el("tracking-note").textContent = "Preparing hand tracking…";
  el("mouse-switch").hidden = true;
  try {
    await tracking.start();
    if (attempt !== cameraAttempt || !tracking.running) return;
    el("camera-empty").hidden = true;
    el("camera-live").hidden = false;
    el("hand-states").hidden = false;
    el("stop").textContent = "Stop camera";
    el("camera-status").textContent = "Live";
    el("camera-status").classList.add("live");
    el("calibrate").hidden = false;
    el("tracking-note").textContent = "Show your hands";
  } catch (error) {
    if (attempt !== cameraAttempt) return;
    stopCamera();
    const name = error instanceof Error ? error.name : "";
    el("tracking-note").textContent =
      name === "NotAllowedError"
        ? "Camera access denied. Check camera permissions and try again."
        : name === "NotFoundError"
          ? "No camera found. Connect a webcam."
          : name === "NotReadableError"
            ? "Camera is busy. Close other camera apps."
            : "Hand tracking could not start. Restart the app to retry.";
    el("tracking-note").classList.add("error");
  } finally {
    if (attempt === cameraAttempt) cameraStarting = false;
  }
}
el("start").onclick = startCamera;
el("stop").onclick = stopCamera;
tracking.onEnded = () => {
  stopCamera();
  toast("Camera disconnected.");
};
let lastStats = 0;
tracking.onHands = (hands) => {
  const now = performance.now();
  kitchen.acceptHands(hands, now);
  if (now - lastStats < 200) return;
  for (const side of ["Left", "Right"] as Side[]) {
    const hand = hands.find((h) => h.side === side);
    const row = el(`hand-${side.toLowerCase()}`);
    row.classList.toggle("detected", !!hand);
    const state = hand
      ? !hand.calibrated
        ? "Calibrate"
        : hand.state !== "tracking"
          ? "Recovering"
          : hand.grip
            ? "Grip"
            : "Open"
      : "—";
    if (row.querySelector("b")!.textContent !== state)
      row.querySelector("b")!.textContent = state;
  }
  el<HTMLButtonElement>("calibrate").disabled =
    kitchen.paused || !tracking.canCalibrate;
  const message = hands.length
    ? hands.some((h) => h.calibrated)
      ? "Hand control"
      : "Hold open palms, then calibrate"
    : "No hands detected";
  if (el("tracking-note").textContent !== message)
    el("tracking-note").textContent = message;
  lastStats = now;
};
kitchen.onFrame = () => {
  try {
    tracking.detect(performance.now());
  } catch {
    stopCamera();
    el("tracking-note").textContent =
      "Tracking stopped. Start the camera to retry.";
    el("tracking-note").classList.add("error");
  }
};
el("calibrate").onclick = () => {
  const count = tracking.calibrate();
  if (count) kitchen.parkHeld();
  toast(
    count
      ? "Hands calibrated. Open to enable control."
      : "Hold open palms still for a moment.",
  );
};
function pause() {
  kitchen.paused = !kitchen.paused;
  kitchen.mouseGrip = false;
  el<HTMLButtonElement>("calibrate").disabled =
    kitchen.paused || !tracking.canCalibrate;
  el("paused-overlay").hidden = !kitchen.paused;
  el("pause").innerHTML =
    `${icon(kitchen.paused ? "play" : "pause", 16)}<span>${kitchen.paused ? "Resume" : "Pause"}</span>`;
  el("pause").title = kitchen.paused ? "Resume (Space)" : "Pause (Space)";
}
el("pause").onclick = pause;
el("resume").onclick = pause;
el("reset").onclick = () => kitchen.reset();
function selectHand(side: Side) {
  if (kitchen.mode !== "mouse") return;
  kitchen.interaction.release(kitchen.activeSide);
  kitchen.mouseGrip = false;
  kitchen.activeSide = side;
  document
    .querySelectorAll<HTMLButtonElement>("[data-side]")
    .forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.side === side)),
    );
}
document
  .querySelectorAll<HTMLButtonElement>("[data-side]")
  .forEach(
    (button) =>
      (button.onclick = () => selectHand(button.dataset.side as Side)),
  );
function focusKitchen(force?: boolean) {
  const focused = force ?? !el("app").classList.contains("focused");
  el("app").classList.toggle("focused", focused);
  el("fullscreen").setAttribute("aria-pressed", String(focused));
  el("fullscreen").setAttribute(
    "aria-label",
    focused ? "Show camera" : "Focus kitchen",
  );
  el("fullscreen").title = focused ? "Show camera (F)" : "Focus kitchen (F)";
}
el("fullscreen").onclick = () => focusKitchen();
const dialog = el<HTMLDialogElement>("controls-dialog");
let helpPaused = false;
function openHelp() {
  helpPaused = !kitchen.paused;
  if (helpPaused) pause();
  dialog.showModal();
}
el("help-open").onclick = openHelp;
el("help-close").onclick = () => dialog.close();
dialog.addEventListener("close", () => {
  if (helpPaused && kitchen.paused) pause();
  helpPaused = false;
});
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  )
    dialog.close();
});
document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (event.target as HTMLElement).closest("input,textarea,select") ||
    dialog.open
  )
    return;
  if (event.key === "?") {
    event.preventDefault();
    openHelp();
    return;
  }
  if (event.code === "Escape" && el("app").classList.contains("focused"))
    focusKitchen(false);
  if (
    event.code === "Space" &&
    !(event.target as HTMLElement).closest("button")
  ) {
    event.preventDefault();
    pause();
  }
  if (event.code === "KeyR") kitchen.reset();
  if (event.code === "KeyF") focusKitchen();
  if (event.code === "KeyQ") selectHand("Left");
  if (event.code === "KeyE") selectHand("Right");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !kitchen.paused) pause();
});
window.addEventListener("pagehide", () => tracking.stop());

const splitter = el("splitter");
let splitting = false;
function resizeCamera(width: number) {
  const max = Math.min(600, innerWidth * 0.5);
  const value = Math.max(240, Math.min(max, width));
  el("app").style.setProperty("--camera-width", `${value}px`);
  splitter.setAttribute("aria-valuenow", String(Math.round(value)));
  splitter.setAttribute("aria-valuemax", String(Math.round(max)));
}
splitter.onpointerdown = (event) => {
  if (event.button !== 0) return;
  splitting = true;
  splitter.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing");
};
splitter.onpointermove = (event) => {
  if (splitting) resizeCamera(event.clientX);
};
const endSplit = () => {
  splitting = false;
  document.body.classList.remove("resizing");
};
splitter.onpointerup = endSplit;
splitter.onpointercancel = endSplit;
splitter.onkeydown = (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  resizeCamera(
    document.querySelector(".input-panel")!.getBoundingClientRect().width +
      (event.key === "ArrowLeft" ? -16 : 16),
  );
};
window.addEventListener("resize", () => {
  if (el("app").style.getPropertyValue("--camera-width"))
    resizeCamera(
      document.querySelector(".input-panel")!.getBoundingClientRect().width,
    );
});
if (import.meta.env.DEV)
  (window as unknown as { __kitchen: Kitchen }).__kitchen = kitchen;

if (import.meta.env.DEV)
  (window as unknown as { __tracking: Tracking }).__tracking = tracking;
