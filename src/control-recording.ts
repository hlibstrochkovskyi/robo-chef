import { ControlCore, type InputFrame, type Detection } from "./control-core";
export type TraceEvent =
  { type: "frame"; frame: InputFrame } | { type: "calibrate"; time: number };
export interface ControlTrace {
  version: 1;
  depth: "relative-palm-scale";
  events: TraceEvent[];
  truncated: boolean;
}
export const eventTime = (event: TraceEvent) =>
  event.type === "frame" ? event.frame.time : event.time;
export class TraceRecorder {
  trace: ControlTrace = {
    version: 1,
    depth: "relative-palm-scale",
    events: [],
    truncated: false,
  };
  recording = false;
  private origin = 0;
  private frames = 0;
  start(now: number) {
    this.origin = now;
    this.frames = 0;
    this.trace = {
      version: 1,
      depth: "relative-palm-scale",
      events: [],
      truncated: false,
    };
    this.recording = true;
  }
  frame(frame: InputFrame) {
    if (!this.recording) return;
    if (this.frames++ >= 3000) {
      this.recording = false;
      this.trace.truncated = true;
      return;
    }
    this.trace.events.push({
      type: "frame",
      frame: {
        time: Math.max(0, frame.time - this.origin),
        detections: structuredClone(frame.detections),
      },
    });
  }
  calibrate(now: number) {
    if (this.recording)
      this.trace.events.push({
        type: "calibrate",
        time: Math.max(0, now - this.origin),
      });
  }
  stop() {
    this.recording = false;
    return this.trace;
  }
}
export function parseTrace(value: unknown): ControlTrace {
  const trace = value as ControlTrace;
  if (
    !trace ||
    trace.version !== 1 ||
    trace.depth !== "relative-palm-scale" ||
    !Array.isArray(trace.events) ||
    trace.events.length > 3200
  )
    throw new Error("Unsupported tracking recording.");
  let previous = -1;
  for (const event of trace.events) {
    if (!event || !["frame", "calibrate"].includes(event.type))
      throw new Error("Invalid recording event.");
    const time = eventTime(event);
    if (!Number.isFinite(time) || time < previous || time < 0 || time > 600000)
      throw new Error("Invalid recording timestamps.");
    previous = time;
    if (event.type === "frame") {
      if (
        !Array.isArray(event.frame.detections) ||
        event.frame.detections.length > 2
      )
        throw new Error("Invalid hand count.");
      for (const d of event.frame.detections as Detection[]) {
        if (
          !d ||
          !["Left", "Right"].includes(d.label) ||
          !Number.isFinite(d.score) ||
          d.score < 0 ||
          d.score > 1
        )
          throw new Error("Invalid handedness.");
        for (const points of [d.landmarks, d.world])
          if (
            !Array.isArray(points) ||
            points.length !== 21 ||
            !points.every(
              (p) =>
                p &&
                [p.x, p.y, p.z].every(
                  (n) => Number.isFinite(n) && Math.abs(n) < 10,
                ),
            )
          )
            throw new Error("Invalid landmarks.");
      }
    }
  }
  return structuredClone(trace);
}
export function replayTrace(trace: ControlTrace) {
  const core = new ControlCore();
  return parseTrace(trace).events.flatMap((event) => {
    if (event.type === "calibrate") {
      core.calibrate();
      return [];
    }
    return [{ time: event.frame.time, hands: core.process(event.frame) }];
  });
}
