import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { existsSync } from "node:fs";

test(
  "kitchen renders, mouse completes the task, camera model starts, and pause/reset work",
  { timeout: 90000 },
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
      await page.screenshot({ path: "/tmp/robo-chef-desktop.png" });
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
      await page.getByRole("heading", { name: "Cup placed" }).waitFor();
      await page.keyboard.press("Space");
      await page
        .getByRole("heading", { name: "Paused", exact: true })
        .waitFor();
      await page.screenshot({ path: "/tmp/robo-chef-paused.png" });
      await page.keyboard.press("Space");
      assert.equal(await page.locator("#paused-overlay").isVisible(), false);
      await page.getByRole("button", { name: "Reset table" }).click();
      await page.getByRole("heading", { name: "Place the cup" }).waitFor();
      await page.getByRole("button", { name: "Hands", exact: true }).click();
      await page.waitForFunction(
        () => document.getElementById("camera-status")?.textContent === "Live",
        {},
        { timeout: 60000 },
      );
      await page.waitForTimeout(1000);
      assert.equal(
        await page.locator("#tracking-note").textContent(),
        "Hands out of view. Move them into the camera.",
      );
      assert.equal(
        await page.locator("#mode-hands").getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(await page.locator("#mouse-switch").isVisible(), false);
      await page.getByRole("button", { name: "Mouse", exact: true }).click();
      assert.equal(
        await page.locator("#mode-mouse").getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(await page.locator("#camera-status").textContent(), "Off");
      assert.equal(
        await page
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.srcObject),
        null,
      );
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
      await page.getByRole("button", { name: "Hands", exact: true }).click();
      await page
        .getByText(
          "Camera access denied. Check camera permissions and try again.",
        )
        .waitFor();
      assert.equal(
        await page.locator("#mode-mouse").getAttribute("aria-pressed"),
        "true",
      );
      await page.evaluate(() => {
        navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
      });
      await page.getByRole("button", { name: "Hands", exact: true }).click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(await page.locator("#camera-status").textContent(), "Off");
      assert.equal(
        await page.getByRole("button", { name: "Enable camera" }).isVisible(),
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
