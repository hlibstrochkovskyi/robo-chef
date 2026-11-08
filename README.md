# Robo Chef

A desktop kitchen controlled by your hands and a webcam. Built with Electron.

```sh
npm install
npm start
```

Opens a native window. No web server required. First launch downloads the hand model.

- **Camera:** hold open palms steady, calibrate, then pinch near a handle or object to grab it. Open your fingers to release.
- **Reach:** raise your hand to lift; approach the camera to reach farther. Left/right follows the mirrored preview. Depth is relative.
- **Mouse:** move to reach, hold the primary button to grab, release to drop.
- **Space:** pause. **R:** reset.
- **F:** focus the kitchen. **Q / E:** choose the left / right hand in mouse mode.
- **?:** controls and shortcuts. **F8:** diagnostics, input recording, replay.

Free interaction with the cup, tomato, and egg. Drag the divider to resize the camera view.

```sh
npm test
npm run build
npm run test:desktop
npm run test:browser
npm run package
```

Linux AppImage: `release/`. Requires a webcam and graphics support.

Prototype: constrained robot motion, assisted contact proxies, relative depth, and simple settling. No full contact physics yet. Video stays on the device; runtime assets are bundled locally.

Desktop checks use a simulated camera, not real hands. Browser checks additionally need Chromium (`npx playwright install chromium`).

Built with [Three.js](https://threejs.org/) and [MediaPipe](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker).

See [control behavior and manual checks](docs/controls.md).
