# Robo Chef

A desktop kitchen controlled by your hands and a webcam. Built with Electron.

```sh
npm install
npm start
```

Opens a native window. No web server required. First launch downloads the hand model.

- **Camera:** show your palms, calibrate, then pinch near an object to grab it. Open your fingers to release.
- **Reach:** move up in the video to reach farther across the table. Left/right follows the mirrored preview.
- **Mouse:** move to reach, hold the primary button to grab, release to drop.
- **Space:** pause. **R:** reset.
- **F:** focus the kitchen. **Q / E:** choose the left / right hand in mouse mode.
- **?:** controls and shortcuts.

First task: put the orange cup in the circle on the cutting board.

```sh
npm test
npm run build
npm run test:desktop
npm run test:browser
npm run package
```

Linux AppImage: `release/`. Requires a webcam and graphics support.

Prototype: assisted grabs, approximate depth, simple gravity. No cooking or full contact physics yet. Video stays on the device; runtime assets are bundled locally.

Desktop checks use a simulated camera, not real hands. Browser checks additionally need Chromium (`npx playwright install chromium`).

Built with [Three.js](https://threejs.org/) and [MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker).
