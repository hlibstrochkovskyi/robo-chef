import type { Tracking } from "./tracking";
import type { Kitchen } from "./scene";
import { parseTrace } from "./control-recording";
export function diagnostics(
  tracking: Tracking,
  kitchen: Kitchen,
  stopCamera: () => void,
) {
  const panel = document.createElement("aside");
  panel.id = "diagnostics";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Control diagnostics");
  panel.innerHTML = `<div class="diagnostics-heading"><strong>Control diagnostics</strong><button id="diagnostics-close" class="small-button" aria-label="Close diagnostics">Close</button></div><div class="diagnostics-actions"><button id="trace-record" class="small-button">Record input</button><button id="trace-export" class="small-button">Export JSON</button><label class="small-button">Replay JSON<input id="trace-import" type="file" accept="application/json,.json" hidden></label></div><label class="diagnostics-toggle"><input id="debug-targets" type="checkbox"> Show raw / filtered targets</label><p id="trace-message">F8 to hide. Record before calibration. No video is saved.</p><pre id="diagnostics-state"></pre>`;
  document.body.append(panel);
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  let timer: ReturnType<typeof setInterval> | undefined;
  const format = (p: { x: number; y: number; z: number }) =>
    [p.x, p.y, p.z].map((v) => v.toFixed(3)).join(" ");
  function render() {
    get("trace-record").textContent = tracking.recorder.recording
      ? "Stop recording"
      : "Record input";
    get("diagnostics-state").textContent =
      (["Left", "Right"] as const)
        .map((side) => {
          const track = tracking.core.tracks[side],
            sample = tracking.latest.find((h) => h.side === side),
            robot = kitchen.hands[side];
          return `${side}: ${sample?.state ?? "missing"} / ${track.neutral ? "calibrated" : "uncalibrated"}\nraw image XY: ${format(track.center)}\nraw world goal: ${format(track.rawTarget)}\nfiltered goal: ${format(track.target)}\nrobot palm: ${format(robot.position)}\nhandedness score: ${sample ? sample.score.toFixed(3) : "—"} (${sample?.rawLabel ?? "—"})\ngrip: ${sample?.grip ?? false} / ${kitchen.interaction.state[side]}`;
        })
        .join("\n\n") +
      `\n\nFrames recorded: ${tracking.recorder.trace.events.filter((e) => e.type === "frame").length}${tracking.recorder.trace.truncated ? " (limit reached)" : ""}`;
  }
  function toggle() {
    panel.hidden = !panel.hidden;
    if (timer) clearInterval(timer);
    if (!panel.hidden) {
      render();
      timer = setInterval(render, 200);
    }
  }
  get("diagnostics-close").onclick = toggle;
  document.addEventListener("keydown", (event) => {
    if (event.code === "F8") {
      event.preventDefault();
      toggle();
    }
  });
  get<HTMLInputElement>("debug-targets").onchange = (event) =>
    kitchen.showTargets((event.target as HTMLInputElement).checked);
  get("trace-record").onclick = () => {
    if (tracking.recorder.recording) {
      tracking.recorder.stop();
      get("trace-message").textContent =
        "Recording stopped. Export JSON to save it.";
    } else if (!tracking.running)
      get("trace-message").textContent = "Start the camera before recording.";
    else {
      kitchen.reset();
      tracking.record();
      get("trace-message").textContent =
        "Recording. Kitchen reset. Hold open palms, calibrate, then reproduce the problem.";
    }
    render();
  };
  get("trace-export").onclick = () => {
    const trace = tracking.recorder.trace;
    if (!trace.events.length) {
      get("trace-message").textContent = "No frames recorded.";
      return;
    }
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(trace)], { type: "application/json" }),
      ),
      link = document.createElement("a");
    link.href = url;
    link.download = "robo-chef-tracking.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  get<HTMLInputElement>("trace-import").onchange = async (event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024)
        throw new Error("Recording is too large.");
      const trace = parseTrace(JSON.parse(await file.text()));
      stopCamera();
      kitchen.setMode("camera");
      kitchen.reset();
      if (kitchen.paused) get("pause").click();
      tracking.play(trace);
      get("camera-empty").hidden = true;
      get("camera-live").hidden = false;
      get("camera-status").textContent = "Replay";
      get("stop").hidden = false;
      get("stop").textContent = "Stop replay";
      get("calibrate").hidden = true;
      get("tracking-note").textContent = "Replaying recorded input";
      get("hand-states").hidden = false;
      get("mouse-switch").hidden = true;
      get("start").hidden = true;
      get("trace-message").textContent =
        `Replaying ${file.name}. Recorded calibration is applied automatically.`;
    } catch (error) {
      get("trace-message").textContent =
        error instanceof Error ? error.message : "Invalid recording.";
    }
    input.value = "";
  };
  tracking.onReplayEnd = () => {
    stopCamera();
    get("trace-message").textContent = "Replay finished.";
    render();
  };
}
