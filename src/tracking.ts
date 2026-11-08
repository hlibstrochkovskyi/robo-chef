import type {
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import { CONNECTIONS, type HandInput } from "./hand-input";
import { ControlCore, type ControlHand, type InputFrame } from "./control-core";

import {
  TraceRecorder,
  parseTrace,
  eventTime,
  type ControlTrace,
} from "./control-recording";

export class Tracking {
  model: HandLandmarker | null = null;
  stream: MediaStream | null = null;
  lastTime = -1;
  lastDetect = 0;
  running = false;
  generation = 0;
  latest: ControlHand[] = [];
  core = new ControlCore();
  recorder = new TraceRecorder();
  replay: { trace: ControlTrace; index: number; started: number } | null = null;
  onReplayEnd: () => void = () => {};
  onFrameData: (frame: InputFrame) => void = () => {};
  onHands: (hands: ControlHand[], ms: number) => void = () => {};
  onEnded: () => void = () => {};
  constructor(
    public video: HTMLVideoElement,
    public canvas: HTMLCanvasElement,
  ) {}
  async start() {
    const generation = ++this.generation;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("Camera access requires localhost or HTTPS.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
      if (generation !== this.generation) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (!this.model) {
        const { FilesetResolver, HandLandmarker } =
          await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks(
          `${import.meta.env.BASE_URL}mediapipe`,
        );
        this.model = await HandLandmarker.createFromOptions(files, {
          baseOptions: {
            modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
      }
      if (generation !== this.generation) return;
      this.running = true;
      this.lastTime = -1;
      this.lastDetect = 0;
      this.core.reset();
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (this.running) {
          this.stop();
          this.onEnded();
        }
      });
    } catch (error) {
      if (generation === this.generation) this.stop();
      throw error;
    }
  }
  stop() {
    this.generation++;
    this.running = false;
    this.replay = null;
    this.recorder.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.latest = [];
    this.core.reset();
    this.canvas
      .getContext("2d")
      ?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  detect(now: number) {
    if (this.replay) {
      const player = this.replay;
      while (
        player.index < player.trace.events.length &&
        eventTime(player.trace.events[player.index]) <= now - player.started
      ) {
        const event = player.trace.events[player.index++];
        if (event.type === "calibrate") this.core.calibrate();
        else this.process(event.frame);
      }
      if (player.index === player.trace.events.length) {
        this.replay = null;
        this.onReplayEnd();
      }
      return;
    }
    if (
      !this.running ||
      !this.model ||
      this.video.readyState < 2 ||
      this.lastTime === this.video.currentTime ||
      now - this.lastDetect < 50
    )
      return;
    this.lastTime = this.video.currentTime;
    this.lastDetect = now;
    const start = performance.now();
    const result = this.model.detectForVideo(this.video, now);
    const frame: InputFrame = {
      time: now,
      detections: result.landmarks.map((landmarks, i) => ({
        label: result.handedness[i][0].categoryName as "Left" | "Right",
        score: result.handedness[i][0].score,
        landmarks,
        world: result.worldLandmarks[i],
      })),
    };
    this.recorder.frame(frame);
    this.process(frame, performance.now() - start);
  }
  position(hand: HandInput) {
    return (
      this.latest.find((h) => h.side === hand.side)?.target ?? {
        x: 0,
        y: 0.5,
        z: 0.45,
      }
    );
  }
  calibrate() {
    const count = this.core.calibrate();
    if (count) this.recorder.calibrate(performance.now());
    return count;
  }
  process(frame: InputFrame, ms = 0) {
    this.onFrameData(frame);
    this.latest = this.core.process(frame);
    this.drawHands(this.latest);
    this.onHands(this.latest, ms);
  }
  record() {
    this.core.reset();
    this.latest = [];
    this.recorder.start(performance.now());
  }
  play(trace: ControlTrace) {
    this.stop();
    this.replay = {
      trace: parseTrace(trace),
      index: 0,
      started: performance.now(),
    };
  }
  get canCalibrate() {
    return this.core.canCalibrate("Left") || this.core.canCalibrate("Right");
  }
  drawHands(hands: HandInput[]) {
    this.draw({
      landmarks: hands.map((h) => h.landmarks),
      handedness: hands.map((h) => [{ categoryName: h.side }]),
    } as HandLandmarkerResult);
  }
  draw(result: HandLandmarkerResult) {
    const c = this.canvas;
    c.width = this.video.videoWidth || 640;
    c.height = this.video.videoHeight || 480;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < result.landmarks.length; i++) {
      const points = result.landmarks[i],
        color =
          result.handedness[i][0].categoryName === "Left"
            ? "#66b9ff"
            : "#ffd08a";
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const [a, b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(points[a].x * c.width, points[a].y * c.height);
        ctx.lineTo(points[b].x * c.width, points[b].y * c.height);
        ctx.stroke();
      }
      for (const p of points) {
        ctx.beginPath();
        ctx.arc(p.x * c.width, p.y * c.height, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    }
  }
}
