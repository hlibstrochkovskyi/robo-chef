import "./style.css";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import { Kitchen } from "./scene";
import { Tracking } from "./tracking";
import type { Side } from "./hand-input";

const icon = (name: string, size = 20) => {
  const paths: Record<string, string> = {
    camera:
      '<rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
    hand: '<path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1c-2 0-4-1-5-3l-4-5a1.8 1.8 0 0 1 2.5-2.5L8 14"/>',
    reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    cup: '<path d="M5 5h11v10a5 5 0 0 1-10 0V5Zm11 1h2a3 3 0 0 1 0 6h-2M4 21h14"/>',
    mouse:
      '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6"/>',
    focus:
      '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
    chef: '<path d="M7 15a5 5 0 1 1 1-9 4.5 4.5 0 0 1 8 0 5 5 0 1 1 1 9v6H7v-6Zm0 1h10"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ""}</svg>`;
};
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="app-header"><a class="brand" href="./" aria-label="Robo Chef home"><span class="brand-icon">${icon("chef", 26)}</span>robo chef<span class="version">Playground</span></a><span class="header-note">Your hands. A different kitchen.</span><span class="prototype"><span></span>Prototype 0.1</span></header>
  <main>
    <div class="workspace-heading"><div><h1>A little kitchen. All yours.</h1><p>Reach out, pick something up, and make yourself at home.</p></div><div class="toolbar"><button id="pause" class="button secondary">${icon("pause")}<span>Pause</span></button><button id="reset" class="button secondary">${icon("reset")}Reset table</button></div></div>
    <div class="workspace">
      <aside class="input-panel panel">
        <div class="panel-heading"><h2>${icon("camera")}Your camera</h2><span id="camera-status" class="status">Off</span></div>
        <div class="camera-view"><video id="video" playsinline muted></video><canvas id="overlay"></canvas><div id="camera-empty"><div class="camera-symbol">${icon("hand", 48)}</div><h3>Bring your hands to the table</h3><p>Turn on your camera to control<br>the robot with your own hands.</p><button id="start" class="button primary">${icon("camera")}Enable camera</button><span class="privacy">Video stays on this device</span></div><div id="camera-live" hidden><span class="live-dot"></span>Mirrored view</div></div>
        <div class="camera-controls"><div class="hands-status"><span id="hand-left"><i class="hand-dot left"></i>Left hand<b>—</b></span><span id="hand-right"><i class="hand-dot right"></i>Right hand<b>—</b></span></div><div class="camera-actions"><button id="calibrate" class="button secondary" disabled>${icon("focus", 17)}Calibrate</button><button id="stop" class="text-button" hidden>Turn off camera</button></div><p id="tracking-note" class="tracking-note" aria-live="polite">No camera needed to explore. Try the mouse first.</p></div>
        <div class="mission"><span class="mission-icon">${icon("cup", 24)}</span><div><span class="subtle-label">Your first task</span><h3 id="mission-title">A place for your cup</h3><p id="mission-copy">Pick up the orange cup and put it inside the circle on the cutting board.</p><div class="task-steps"><span id="step-pick"><i>1</i>Pick up</span><span class="step-line"></span><span id="step-place"><i>2</i>Place down</span></div></div></div>
      </aside>
      <section class="kitchen-panel panel"><div class="panel-heading"><h2>${icon("chef")}The kitchen</h2><div class="scene-tools"><span id="input-status" class="input-status">${icon("mouse", 15)}Mouse control</span><button id="fullscreen" class="icon-button" aria-label="Toggle kitchen fullscreen" title="Fullscreen">${icon("focus", 18)}</button></div></div><div id="scene"><div class="scene-label"><span class="scene-dot"></span>Through the robot’s eyes</div><div id="paused-overlay" hidden>${icon("pause", 32)}<strong>Take your time</strong><span>Press Space to continue</span></div><div class="scene-bottom"><span id="scene-hint">Move to the cup. Hold to pick it up.</span><div id="mouse-switch"><button data-side="Left">Left hand</button><button data-side="Right" class="selected">Right hand</button></div></div></div></section>
    </div>
    <footer><div class="tip">${icon("hand", 22)}<span id="help"><strong>Try it with your mouse</strong> Move to reach · Hold to grab · Release to drop</span></div><div class="shortcuts"><span><kbd>Space</kbd> Pause</span><span><kbd>R</kbd> Reset</span></div></footer>
  </main><div id="toast" role="status" hidden></div>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let kitchen: Kitchen;
try {
  kitchen = new Kitchen(el("scene"));
} catch {
  el("scene").innerHTML =
    '<div class="scene-error"><h2>3D needs WebGL</h2><p>Enable hardware acceleration or try a current desktop browser.</p></div>';
  el<HTMLButtonElement>("start").disabled = true;
  throw new Error("WebGL is unavailable.");
}
const tracking = new Tracking(
  el<HTMLVideoElement>("video"),
  el<HTMLCanvasElement>("overlay"),
);
let toastTimer: ReturnType<typeof setTimeout>;
let cameraStarting = false;
function toast(text: string) {
  el("toast").textContent = text;
  el("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el("toast").hidden = true), 4000);
}
function stopCamera() {
  tracking.stop();
  cameraStarting = false;
  kitchen.setMode("mouse");
  el("camera-empty").hidden = false;
  el("camera-live").hidden = true;
  el("stop").hidden = true;
  el("camera-status").textContent = "Off";
  el("camera-status").classList.remove("on");
  el("input-status").innerHTML = `${icon("mouse", 15)}Mouse control`;
  el("mouse-switch").hidden = false;
  el("scene-hint").textContent = "Move to the cup. Hold to pick it up.";
  el("help").innerHTML =
    "<strong>Try it with your mouse</strong> Move to reach · Hold to grab · Release to drop";
  el("tracking-note").textContent =
    "No camera needed to explore. Try the mouse first.";
  el<HTMLButtonElement>("calibrate").disabled = true;
  el<HTMLButtonElement>("start").disabled = false;
  el("start").innerHTML = `${icon("camera")}Enable camera`;
  for (const side of ["left", "right"])
    el(`hand-${side}`).querySelector("b")!.textContent = "—";
}
el("start").onclick = async () => {
  if (cameraStarting) return;
  cameraStarting = true;
  el<HTMLButtonElement>("start").disabled = true;
  el("start").textContent = "Preparing camera…";
  el("camera-status").textContent = "Starting";
  try {
    await tracking.start();
    if (!tracking.running) return;
    kitchen.setMode("camera");
    el("camera-empty").hidden = true;
    el("camera-live").hidden = false;
    el("stop").hidden = false;
    el("camera-status").textContent = "Live";
    el("camera-status").classList.add("on");
    el("input-status").innerHTML = `${icon("hand", 15)}Hand tracking`;
    el("mouse-switch").hidden = true;
    el("help").innerHTML =
      "<strong>You’re in control</strong> Pinch to grab · Open to release · Move up in the video to reach";
    el("scene-hint").textContent =
      "Show your hands. Pinch near the cup to pick it up.";
    el("tracking-note").textContent = "Show both open palms, then calibrate.";
  } catch (error) {
    stopCamera();
    const name = error instanceof Error ? error.name : "";
    const message =
      name === "NotAllowedError"
        ? "Camera blocked. Allow camera access in your browser and try again."
        : name === "NotFoundError"
          ? "No camera found. Connect a webcam or use mouse control."
          : name === "NotReadableError"
            ? "Camera is busy. Close other camera apps and try again."
            : "Could not start hand tracking. Run npm run setup, then try again.";
    el("tracking-note").textContent = message;
    toast(message);
  } finally {
    cameraStarting = false;
  }
};
el("stop").onclick = stopCamera;
tracking.onEnded = () => {
  stopCamera();
  toast("Camera disconnected. Mouse control is ready.");
};
let lastStats = 0;
tracking.onHands = (hands, ms) => {
  const now = performance.now();
  for (const hand of hands) {
    const robot = kitchen.hands[hand.side];
    robot.target.set(
      ...(Object.values(tracking.position(hand)) as [number, number, number]),
    );
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
  if (now - lastStats > 200) {
    for (const side of ["Left", "Right"] as Side[]) {
      const hand = hands.find((h) => h.side === side);
      el(`hand-${side.toLowerCase()}`).querySelector("b")!.textContent = hand
        ? hand.grip
          ? "Gripping"
          : "Open"
        : "Not visible";
    }
    el<HTMLButtonElement>("calibrate").disabled = hands.length === 0;
    el("tracking-note").textContent = hands.length
      ? `${hands.length} ${hands.length === 1 ? "hand" : "hands"} detected · ${Math.round(ms)} ms tracking`
      : "Hands out of view. Move them into the camera.";
    lastStats = now;
  }
};
kitchen.onFrame = () => {
  try {
    tracking.detect(performance.now());
  } catch {
    stopCamera();
    toast("Tracking stopped. Turn the camera on to retry.");
  }
};
el("calibrate").onclick = () => {
  const n = tracking.calibrate();
  toast(
    n
      ? `Calibrated ${n === 2 ? "both hands" : "one hand"}. This is your neutral position.`
      : "Show an open palm to calibrate.",
  );
};
function pause() {
  kitchen.paused = !kitchen.paused;
  kitchen.mouseGrip = false;
  el("paused-overlay").hidden = !kitchen.paused;
  el("pause").innerHTML =
    `${icon(kitchen.paused ? "play" : "pause")}<span>${kitchen.paused ? "Resume" : "Pause"}</span>`;
}
function reset() {
  kitchen.reset();
  el("scene-hint").textContent =
    kitchen.mode === "mouse"
      ? "Move to the cup. Hold to pick it up."
      : "Show your hands. Pinch near the cup to pick it up.";
  el("step-pick").classList.remove("done");
  toast("Table reset. Try again.");
}
el("pause").onclick = pause;
el("reset").onclick = reset;
document.querySelectorAll<HTMLButtonElement>("[data-side]").forEach(
  (button) =>
    (button.onclick = () => {
      kitchen.interaction.release(kitchen.activeSide);
      kitchen.mouseGrip = false;
      kitchen.activeSide = button.dataset.side as Side;
      document
        .querySelectorAll("[data-side]")
        .forEach((b) => b.classList.toggle("selected", b === button));
    }),
);
el("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el("scene").requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable in this browser.");
  }
};
document.addEventListener("keydown", (e) => {
  if (
    e.repeat ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    (e.target as HTMLElement).closest("button,input,textarea,select")
  )
    return;
  if (e.code === "Space") {
    e.preventDefault();
    pause();
  }
  if (e.code === "KeyR") reset();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !kitchen.paused) pause();
});
window.addEventListener("pagehide", () => tracking.stop());
kitchen.interaction.onGrab = (id) => {
  el("scene-hint").textContent =
    `Holding the ${id === "mug" ? "cup" : id}. Move, then release to place.`;
  if (id === "mug") el("step-pick").classList.add("done");
};
kitchen.interaction.onDrop = () => {
  el("scene-hint").textContent = "Release over the circle to place your cup.";
};
kitchen.onProgress = (done) => {
  el("step-place").classList.toggle("done", done);
  el("mission-title").textContent = done
    ? "Nicely done, chef."
    : "A place for your cup";
  el("mission-copy").textContent = done
    ? "Your cup is on the board. Explore the other objects, or reset the table to try again."
    : "Pick up the orange cup and put it inside the circle on the cutting board.";
  if (done) {
    el("scene-hint").textContent =
      "First task complete. Make yourself at home.";
    toast("A perfect place for your cup. Well done!");
  }
};
// Development-only access for interaction checks; excluded from production.
if (import.meta.env.DEV)
  (window as unknown as { __kitchen: Kitchen }).__kitchen = kitchen;
