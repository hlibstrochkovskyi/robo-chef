import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { existsSync } from "node:fs";
import { detection } from "./fixtures/hands";
import { TraceRecorder } from "../src/control-recording";

test(
  "free kitchen supports objects, camera, focus, and pause without task UI",
  { timeout: 150000 },
  async () => {
    const server = await createServer({
      server: {
        host: "127.0.0.1",
        port: 0,
        hmr: false,
        watch: { ignored: ["**/release/**", "**/dist/**"] },
      },
    });
    await server.listen();
    const browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      headless: true,
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        permissions: ["camera"],
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(server.resolvedUrls!.local[0]);
      await page.waitForFunction(() => !!(window as any).__kitchen);
      await page.waitForFunction(
        () => (window as any).__kitchen.scene.userData.texturesLoaded,
      );
      assert.equal(await page.locator("#diagnostics").isVisible(), false);
      await page.keyboard.press("F8");
      await page
        .getByRole("checkbox", { name: "Show raw / filtered targets" })
        .check();
      assert.equal(
        await page.evaluate(
          () => (window as any).__kitchen.debugTargets.visible,
        ),
        true,
      );
      await page.keyboard.press("F8");
      assert.equal(await page.locator("#diagnostics").isVisible(), false);
      await page.screenshot({ path: "/tmp/robo-chef-desktop.png" });
      await page.evaluate(() => {
        const k = (window as any).__kitchen;
        k.scene.userData.reviewCamera = k.camera.clone();
        k.camera.position.set(2.0, 1.55, 2.05);
        k.camera.lookAt(1.45, 0.65, 1.22);
      });
      await page
        .locator("#scene")
        .screenshot({ path: "/tmp/robo-chef-hand-detail.png" });
      await page.evaluate(() => {
        const k = (window as any).__kitchen;
        k.camera.position.set(-0.05, 0.78, 1.02);
        k.camera.lookAt(-0.65, 0.25, 0.25);
      });
      await page
        .locator("#scene")
        .screenshot({ path: "/tmp/robo-chef-cup-detail.png" });
      await page.evaluate(() => {
        const k = (window as any).__kitchen;
        k.camera.copy(k.scene.userData.reviewCamera);
        k.camera.updateProjectionMatrix();
        delete k.scene.userData.reviewCamera;
      });

      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
        true,
      );
      await page
        .getByRole("button", { name: "Focus kitchen", exact: true })
        .click();
      assert.equal(await page.locator(".input-panel").isVisible(), false);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".input-panel").isVisible(), true);
      await page
        .getByRole("button", { name: "Controls and shortcuts", exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").isVisible(), false);
      await page.keyboard.press("q");
      assert.equal(
        await page.locator('[data-side="Left"]').getAttribute("aria-pressed"),
        "true",
      );
      await page.keyboard.press("e");
      const points = await page.evaluate(() => {
        const k = (window as any).__kitchen;
        return {
          cup: k.project({ x: -0.65, y: 0.36, z: 0.25 }),
          target: k.project({ x: 1.3, y: 0.36, z: -0.35 }),
        };
      });
      await page.mouse.move(points.cup.x, points.cup.y);
      await page.waitForTimeout(400);
      await page.mouse.down();
      await page.waitForFunction(
        () => (window as any).__kitchen.interaction.items[0].heldBy === "Right",
      );
      assert.equal(
        await page.evaluate(
          () => (window as any).__kitchen.interaction.items[0].heldBy,
        ),
        "Right",
        JSON.stringify(
          await page.evaluate(() => {
            const k = (window as any).__kitchen;
            return {
              paused: k.paused,
              side: k.activeSide,
              mode: k.mode,
              grip: k.mouseGrip,
              position: k.hands.Right.position,
              target: k.hands.Right.target,
              hover: k.interaction.hover,
            };
          }),
        ),
      );
      await page.mouse.move(points.target.x, points.target.y, { steps: 25 });
      await page.waitForTimeout(400);
      await page.mouse.up();
      await page.waitForFunction(() => {
        const cup = (window as any).__kitchen.interaction.items[0];
        return (
          cup.heldBy === null &&
          Math.abs(cup.position.x - 1.3) < 0.1 &&
          cup.position.y < 0.34
        );
      });
      assert.equal(
        await page
          .locator(".task, #mission-title, #scene-hint, .statusbar")
          .count(),
        0,
      );
      await page.keyboard.press("Space");
      await page
        .getByRole("heading", { name: "Paused", exact: true })
        .waitFor();
      await page.screenshot({ path: "/tmp/robo-chef-paused.png" });
      await page.keyboard.press("Space");
      assert.equal(await page.locator("#paused-overlay").isVisible(), false);
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      await page.waitForFunction(
        () =>
          (window as any).__kitchen.interaction.items[0].position.x === -0.65,
      );
      const separator = page.getByRole("separator", { name: "Resize camera" });
      await separator.focus();
      const before = await page
        .locator(".input-panel")
        .evaluate((node) => node.getBoundingClientRect().width);
      await page.keyboard.press("ArrowRight");
      assert.ok(
        (await page
          .locator(".input-panel")
          .evaluate((node) => node.getBoundingClientRect().width)) > before,
      );
      await page
        .getByRole("button", { name: "Start camera", exact: true })
        .click();
      await page.waitForFunction(
        () => document.getElementById("camera-status")?.textContent === "Live",
        {},
        { timeout: 60000 },
      );
      await page.waitForTimeout(1000);
      assert.equal(
        await page.locator("#tracking-note").textContent(),
        "No hands detected",
      );
      assert.equal(
        await page.evaluate(() => (window as any).__kitchen.mode),
        "camera",
      );
      assert.equal(await page.locator("#mouse-switch").isVisible(), false);
      await page.keyboard.press("F8");
      await page
        .getByRole("button", { name: "Record input", exact: true })
        .click();
      await page.waitForFunction(
        () => (window as any).__tracking.recorder.trace.events.length > 2,
      );
      await page
        .getByRole("button", { name: "Stop recording", exact: true })
        .click();
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export JSON" }).click();
      assert.equal(
        (await downloadPromise).suggestedFilename(),
        "robo-chef-tracking.json",
      );
      await page.keyboard.press("F8");
      await page
        .getByRole("button", { name: "Stop camera", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => (window as any).__kitchen.mode),
        "mouse",
      );
      assert.equal(await page.locator("#camera-status").textContent(), "Off");
      assert.equal(
        await page
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.srcObject),
        null,
      );
      const recorder = new TraceRecorder();
      recorder.start(0);
      for (let time = 0; time <= 800; time += 50)
        recorder.frame({
          time,
          detections: [detection("Left"), detection("Right")],
        });
      recorder.calibrate(825);
      for (let time = 850; time <= 4000; time += 50)
        recorder.frame({
          time,
          detections: [detection("Left"), detection("Right")],
        });
      await page.keyboard.press("F8");
      await page
        .locator("#trace-import")
        .setInputFiles({
          name: "synthetic.json",
          mimeType: "application/json",
          buffer: Buffer.from(JSON.stringify(recorder.stop())),
        });
      await page.waitForFunction(() =>
        (window as any).__tracking.latest.some((h: any) => h.enabled),
      );
      assert.equal(await page.locator("#hand-states").isVisible(), true);
      assert.equal(await page.locator("#mouse-switch").isVisible(), false);
      assert.equal(await page.locator("#calibrate").isVisible(), false);
      await page.waitForFunction(
        () =>
          document.getElementById("trace-message")?.textContent ===
          "Replay finished.",
      );
      assert.equal(await page.locator("#camera-status").textContent(), "Off");
      assert.equal(
        await page.evaluate(() => (window as any).__kitchen.mode),
        "mouse",
      );
      await page.keyboard.press("F8");
      await page.setViewportSize({ width: 900, height: 700 });
      await page.screenshot({ path: "/tmp/robo-chef-compact.png" });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
        true,
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "/tmp/robo-chef-mobile.png",
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError"));
      });
      await page
        .getByRole("button", { name: "Start camera", exact: true })
        .click();
      await page
        .getByText(
          "Camera access denied. Check camera permissions and try again.",
        )
        .waitFor();
      assert.equal(
        await page.evaluate(() => (window as any).__kitchen.mode),
        "mouse",
      );
      await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
      });
      await page
        .getByRole("button", { name: "Start camera", exact: true })
        .click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(await page.locator("#camera-status").textContent(), "Off");
      assert.equal(
        await page.getByRole("button", { name: "Start camera" }).isVisible(),
        true,
      );
      assert.deepEqual(errors, []);
      console.log(
        "Screenshots: /tmp/robo-chef-desktop.png, /tmp/robo-chef-mobile.png",
      );
    } finally {
      await browser.close();
      await server.close();
    }
  },
);
