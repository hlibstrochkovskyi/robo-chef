import { test } from "node:test";
import assert from "node:assert/strict";
import { _electron } from "@playwright/test";
import electron from "electron";

test(
  "desktop loads local assets and runs camera tracking without a web server",
  { timeout: 90000 },
  async () => {
    const app = await _electron.launch({
      executablePath:
        process.env.ROBO_CHEF_EXECUTABLE ?? (electron as unknown as string),
      args: [
        ...(process.env.ROBO_CHEF_EXECUTABLE ? [] : ["."]),
        "--no-sandbox",
        "--ozone-platform=headless",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--use-fake-device-for-media-stream",
      ],
      env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" },
    });
    try {
      const window = await app.firstWindow();
      const errors: string[] = [];
      window.on("pageerror", (e) => errors.push(e.message));
      await window.getByRole("heading", { name: "Robo Chef" }).waitFor();
      assert.equal(window.url(), "app://robo-chef/index.html");
      assert.equal(
        await window.evaluate(async () => {
          const results = await Promise.all(
            ["color", "normal", "roughness"].map(async (name) => {
              const response = await fetch(
                `app://robo-chef/textures/wood/${name}.jpg`,
              );
              return (
                response.ok && (await response.arrayBuffer()).byteLength > 1000
              );
            }),
          );
          return results.every(Boolean);
        }),
        true,
      );

      assert.equal(
        await window.evaluate(async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            stream.getTracks().forEach((t) => t.stop());
            return "allowed";
          } catch {
            return "denied";
          }
        }),
        "denied",
      );
      assert.deepEqual(
        await window.evaluate(() => ({
          node: typeof (window as any).require,
          secure: window.isSecureContext,
        })),
        { node: "undefined", secure: true },
      );
      await window.getByRole("button", { name: "Start camera" }).click();
      await window.waitForFunction(
        () => document.getElementById("camera-status")?.textContent === "Live",
        {},
        { timeout: 60000 },
      );
      await window.waitForFunction(
        () =>
          document.getElementById("tracking-note")?.textContent ===
          "No hands detected",
      );
      await window.getByRole("button", { name: "Stop camera" }).click();
      assert.equal(
        await window
          .locator("video")
          .evaluate((v: HTMLVideoElement) => v.srcObject),
        null,
      );
      await window.screenshot({ path: "/tmp/robo-chef-desktop-app.png" });
      assert.deepEqual(errors, []);
    } finally {
      await app.close();
    }
  },
);
