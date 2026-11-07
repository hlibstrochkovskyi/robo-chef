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
  for (const id of ["start", "mode-hands", "pause", "reset", "fullscreen"])
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
let taskPicked = false;
let taskComplete = false;

function toast(message: string) {
  el("toast").textContent = message;
  el("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el("toast").hidden = true), 4000);
}
function setModeIndicator(mode: "hands" | "mouse") {
  document
    .querySelector(".input-panel")!
    .classList.toggle("using-hands", mode === "hands");
  el("mode-hands").setAttribute("aria-pressed", String(mode === "hands"));
  el("mode-mouse").setAttribute("aria-pressed", String(mode === "mouse"));
  el("input-status").textContent =
    mode === "hands" ? "Hand control" : "Mouse control";
  el("mouse-switch").hidden = mode === "hands";
  el("help").textContent =
    mode === "hands"
      ? "Pinch to grab · Open to place · Move up to reach farther"
      : "Move to reach · Hold to grab · Release to place";
}
function stopCamera() {
  cameraAttempt++;
  tracking.stop();
  cameraStarting = false;
  kitchen.setMode("mouse");
  setModeIndicator("mouse");
  el("camera-empty").hidden = false;
  el("camera-live").hidden = true;
  el("stop").hidden = true;
  el("start").hidden = false;
  el<HTMLButtonElement>("start").disabled = false;
  el("camera-status").textContent = "Off";
  el("camera-status").classList.remove("live");
  el("scene-hint").textContent = "Move to reach. Hold to pick up.";
  el("tracking-note").textContent = "Enable your camera to use your hands.";
  el("tracking-note").classList.remove("error");
  el<HTMLButtonElement>("calibrate").disabled = true;
  el("calibration-note").textContent =
    "Hold your palms open in a comfortable position.";
  for (const side of ["Left", "Right"] as Side[]) {
    const row = el(`hand-${side.toLowerCase()}`);
    row.classList.remove("detected");
    row.querySelector("b")!.textContent = "Not connected";
  }
}
async function startCamera() {
  if (cameraStarting || tracking.running) return;
  const attempt = ++cameraAttempt;
  cameraStarting = true;
  el("start").hidden = true;
  el("stop").hidden = false;
  el("stop").innerHTML = `${icon("close")}Cancel`;
  el("camera-status").textContent = "Connecting";
  el("tracking-note").classList.remove("error");
  el("tracking-note").textContent = "Preparing your camera and hand tracking…";
  setModeIndicator("hands");
  kitchen.setMode("camera");
  try {
    await tracking.start();
    if (attempt !== cameraAttempt || !tracking.running) return;
    kitchen.setMode("camera");
    el("camera-empty").hidden = true;
    el("camera-live").hidden = false;
    el("stop").innerHTML = `${icon("camera")}Turn off camera`;
    el("camera-status").textContent = "Live";
    el("camera-status").classList.add("live");
    el("tracking-note").textContent = "Show both open palms, then calibrate.";
    el("scene-hint").textContent = "Pinch near an object to pick it up.";
  } catch (error) {
    if (attempt !== cameraAttempt) return;
    stopCamera();
    const name = error instanceof Error ? error.name : "";
    const message =
      name === "NotAllowedError"
        ? "Camera access denied. Check camera permissions and try again."
        : name === "NotFoundError"
          ? "No camera found. Connect a webcam to use hand control."
          : name === "NotReadableError"
            ? "Camera is busy. Close other camera apps and try again."
            : "Hand tracking could not start. Restart the app and try again.";
    el("tracking-note").textContent = message;
    el("tracking-note").classList.add("error");
  } finally {
    if (attempt === cameraAttempt) cameraStarting = false;
  }
}
el("start").onclick = startCamera;
el("mode-hands").onclick = startCamera;
el("stop").onclick = stopCamera;
el("mode-mouse").onclick = () => {
  if (tracking.running || cameraStarting) stopCamera();
};
tracking.onEnded = () => {
  stopCamera();
  toast("Camera disconnected. Mouse control is ready.");
};
let lastStats = 0;
tracking.onHands = (hands) => {
  const now = performance.now();
  for (const hand of hands) {
    const robot = kitchen.hands[hand.side];
    const position = tracking.position(hand);
    robot.target.set(position.x, position.y, position.z);
    robot.pose(hand);
    robot.lastSeen = now;
    robot.active = true;
    kitchen.interaction.updateHand(
      hand.side,
      robot.position,
      hand.grip,
      Math.atan2(
        hand.landmarks[5].y - hand.landmarks[17].y,
        hand.landmarks[17].x - hand.landmarks[5].x,
      ),
    );
  }
  if (now - lastStats < 200) return;
  for (const side of ["Left", "Right"] as Side[]) {
    const hand = hands.find((h) => h.side === side);
    const row = el(`hand-${side.toLowerCase()}`);
    row.classList.toggle("detected", !!hand);
    row.querySelector("b")!.textContent = hand
      ? hand.grip
        ? "Gripping"
        : "Open"
      : "Not visible";
  }
  el<HTMLButtonElement>("calibrate").disabled = hands.length === 0;
  const trackingMessage = hands.length
    ? `${hands.length === 2 ? "Both hands" : "One hand"} in view. Pinch to grab.`
    : "Hands out of view. Move them into the camera.";
  if (el("tracking-note").textContent !== trackingMessage)
    el("tracking-note").textContent = trackingMessage;
  lastStats = now;
};
kitchen.onFrame = () => {
  try {
    tracking.detect(performance.now());
  } catch {
    stopCamera();
    el("tracking-note").textContent =
      "Tracking stopped. Enable your camera to retry.";
    el("tracking-note").classList.add("error");
  }
};
el("calibrate").onclick = () => {
  const count = tracking.calibrate();
  if (count) {
    el("calibration-note").textContent =
      `${count === 2 ? "Both hands" : "One hand"} calibrated. Recalibrate if you move.`;
    toast("Neutral position saved.");
  }
};
function pause() {
  kitchen.paused = !kitchen.paused;
  kitchen.mouseGrip = false;
  el<HTMLButtonElement>("calibrate").disabled =
    kitchen.paused || tracking.latest.length === 0;
  el("paused-overlay").hidden = !kitchen.paused;
  el("pause").innerHTML =
    `${icon(kitchen.paused ? "play" : "pause")}<span>${kitchen.paused ? "Resume" : "Pause"}</span>`;
  el("pause").title = kitchen.paused ? "Resume (Space)" : "Pause (Space)";
}
function updateTask() {
  el("step-pick").classList.toggle("done", taskPicked);
  el("step-place").classList.toggle("done", taskComplete);
  el("task-status").textContent = taskComplete
    ? "Complete"
    : taskPicked
      ? "1 / 2"
      : "0 / 2";
  el("mission-title").textContent = taskComplete
    ? "Cup placed"
    : "Place the cup";
  el("mission-copy").textContent = taskComplete
    ? "Try the other objects, or reset the table to practice again."
    : "Move the orange cup onto the circle on the board.";
}
function reset() {
  taskPicked = false;
  taskComplete = false;
  kitchen.reset();
  updateTask();
  el("scene-hint").textContent =
    kitchen.mode === "mouse"
      ? "Move to reach. Hold to pick up."
      : "Pinch near an object to pick it up.";
  toast("Table reset.");
}
el("pause").onclick = pause;
el("resume").onclick = pause;
el("reset").onclick = reset;
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
    focused ? "Show input controls" : "Focus kitchen",
  );
  el("fullscreen").title = focused
    ? "Show input controls (F)"
    : "Focus kitchen (F)";
  if (!focused) el("fullscreen").focus();
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
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  }
});
document.addEventListener("keydown", (event) => {
  if (
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    (event.target as HTMLElement).closest("input,textarea,select")
  )
    return;
  if (dialog.open) return;
  if (event.code === "Escape") {
    focusKitchen(false);
    return;
  }
  if (event.key === "?") {
    event.preventDefault();
    openHelp();
    return;
  }
  if (event.code === "Space") {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    pause();
  }
  if (event.code === "KeyR") reset();
  if (event.code === "KeyF") focusKitchen();
  if (event.code === "KeyQ") selectHand("Left");
  if (event.code === "KeyE") selectHand("Right");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !kitchen.paused) pause();
});
window.addEventListener("pagehide", () => tracking.stop());
kitchen.interaction.onGrab = (id) => {
  el("scene-hint").textContent =
    `Holding ${id === "mug" ? "cup" : id}. Release to place.`;
  if (id === "mug") {
    taskPicked = true;
    updateTask();
  }
};
kitchen.interaction.onDrop = (id) => {
  el("scene-hint").textContent =
    id === "mug"
      ? "Place the cup inside the circle."
      : "Move to reach. Hold to pick up.";
};
kitchen.onProgress = (done) => {
  taskComplete = done;
  updateTask();
  if (done) {
    el("scene-hint").textContent = "Cup placed. Try the other objects.";
    toast("Practice complete.");
  }
};
if (import.meta.env.DEV)
  (window as unknown as { __kitchen: Kitchen }).__kitchen = kitchen;
