# Teleoperation contract

- Mirrored camera X maps to robot X once. Camera up raises robot Y.
- Depth uses calibrated palm area corrected for orientation. Approaching the camera moves forward over the table. This is relative reach, not metric depth. Edge-on palms freeze depth.
- Hold open palms still for about one second, then calibrate. Each hand needs an open observation before a fresh grasp.
- Identity is a one-to-one motion assignment. Handedness is a soft prior, not a track ID.
- Missing input freezes motion. After one second, a held item is parked at its last location. Reacquisition waits for stable observations; long gaps require opening before re-grabbing.
- Pinch or a complete fist with a tucked thumb can grab. Thumbs-up is not a grasp. Transitions require 100 ms of consistent input.
- Camera pickup of a cup requires contact near its handle. Attachment preserves relative position and orientation.
- Robot links and finger lengths are fixed. Wrist rotation, finger bends, workspace, and travel speed are constrained.

## Modules

`control-core.ts`: identity, calibration, relative depth, gesture state.
`hand-pose.ts`, `robot-hand.ts`: retargeting and two-link reach.
`interaction.ts`, `teleoperation.ts`: grasp transforms and collision proxies.
`control-recording.ts`: versioned raw input and deterministic replay.

## Diagnostics

Press F8. Hollow markers show mapped raw goals; solid markers show filtered goals. The panel shows raw image positions, filtered goals, robot positions, and handedness classification scores. Those scores are not landmark confidence.

Start the camera, select Record input, calibrate, then reproduce a failure. Recording and replay reset the kitchen to its initial state. Stop recording and export JSON. Replay JSON feeds the same control core without a camera. No video is recorded. Recordings are limited to 3,000 frames.

```sh
npm run replay -- recording.json filtered-output.json
```

## Manual camera check

1. Calibrate both open palms in good light. Move one hand left/right, then up/down. The other robot must stay still.
2. Approach/retreat without rotating the palm. Repeat while turning edge-on: depth must freeze rather than jump.
3. Hold still, make a thumbs-up, open, pinch, and make a full fist. Check gestures in F8.
4. Cross hands slowly, briefly cover one hand, then uncover it. Check identity and bounded reacquisition. A long gap must park a held item.
5. Approach the cup handle, grasp, lift, carry, open. Repeat ten times, then repeat with the other hand and both hands present.
6. Save any failing input trace for replay.

Automated tests use synthetic landmarks and a simulated camera. They do not establish ten successful transfers with real hands.

## Limits

Severe overlap can make identity ambiguous; the controller may pause rather than guess. Collision handling uses conservative palm/finger spheres and solid object proxies. It does not model the mug cavity, exact handle tubes, full arm/environment collisions, friction, or articulated contact forces. Released items settle upright with gravity; this is not a full rigid-body solver. Mouse pickup remains assisted.
