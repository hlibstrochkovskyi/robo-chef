import type {
  HandLandmarker,
  HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import {
  CONNECTIONS,
  isGripping,
  distance,
  tablePosition,
  clamp,
  type Side,
  type Point,
  type HandInput,
} from "./hand-input";

export class Tracking {
  model: HandLandmarker | null = null;
  stream: MediaStream | null = null;
  lastTime = -1;
  lastDetect = 0;
  running = false;
  generation = 0;
  latest: HandInput[] = [];
  private grips = new Map<Side, boolean>();
  private neutral = new Map<Side, { size: number; position: Point }>();
  onHands: (hands: HandInput[], ms: number) => void = () => {};
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
      this.grips.clear();
      this.neutral.clear();
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
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.latest = [];
    this.grips.clear();
    this.canvas
      .getContext("2d")
      ?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  detect(now: number) {
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
    this.latest = result.landmarks.map((landmarks, i) => {
      const side = result.handedness[i][0].categoryName as Side;
      const grip = isGripping(landmarks, this.grips.get(side));
      this.grips.set(side, grip);
      return { side, landmarks, world: result.worldLandmarks[i], grip };
    });
    const visible = new Set(this.latest.map((h) => h.side));
    for (const side of this.grips.keys())
      if (!visible.has(side)) this.grips.delete(side);
    this.draw(result);
    this.onHands(this.latest, performance.now() - start);
  }
  position(hand: HandInput) {
    const size = distance(hand.landmarks[0], hand.landmarks[9]);
    const neutral = this.neutral.get(hand.side);
    const p = tablePosition(hand.landmarks[9], neutral?.size ?? 0.16, size);
    if (neutral) {
      const origin = tablePosition(
        neutral.position,
        neutral.size,
        neutral.size,
      );
      p.x = p.x - origin.x + (hand.side === "Left" ? -0.95 : 0.95);
      p.z = p.z - origin.z + 0.5;
    }
    return { ...p, x: clamp(p.x, -2.6, 2.6), z: clamp(p.z, -1.15, 1.6) };
  }
  calibrate() {
    for (const h of this.latest)
      this.neutral.set(h.side, {
        size: distance(h.landmarks[0], h.landmarks[9]),
        position: { ...h.landmarks[9] },
      });
    return this.latest.length;
  }
  draw(result: HandLandmarkerResult) {
    const c = this.canvas;
    c.width = this.video.videoWidth;
    c.height = this.video.videoHeight;
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
