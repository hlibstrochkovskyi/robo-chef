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
      server: { host: "127.0.0.1", port: 5173, strictPort: true },
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
      await page.goto("http://127.0.0.1:5173");
      await page.waitForFunction(() => !!(window as any).__kitchen);
      await page.screenshot({ path: "/tmp/robo-chef-desktop.png" });
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
      await page.waitForTimeout(150);
      assert.equal(
        await page.evaluate(
          () => (window as any).__kitchen.interaction.items[0].heldBy,
        ),
        "Right",
      );
      await page.mouse.move(points.target.x, points.target.y, { steps: 25 });
      await page.waitForTimeout(400);
      await page.mouse.up();
      await page.getByRole("heading", { name: "Nicely done, chef." }).waitFor();
      await page.keyboard.press("Space");
      await page.getByText("Take your time").waitFor();
      await page.keyboard.press("Space");
      assert.equal(await page.locator("#paused-overlay").isVisible(), false);
      await page.getByRole("button", { name: "Reset table" }).click();
      await page
        .getByRole("heading", { name: "A place for your cup" })
        .waitFor();
      await page.getByRole("button", { name: "Enable camera" }).click();
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
      await page.getByRole("button", { name: "Turn off camera" }).click();
      assert.equal(await page.locator("#camera-status").textContent(), "Off");
      assert.equal(
        await page
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.srcObject),
        null,
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
