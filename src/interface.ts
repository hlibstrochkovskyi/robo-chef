export function icon(name: string, size = 18) {
  const paths: Record<string, string> = {
    robot:
      '<path d="M4 19v-5l5-5 3 3-4 4v3M9 9l4-5 3 2-3 6M13 4l2-2m1 4 3-1M3 21h7"/><circle cx="6" cy="14" r="2"/>',
    camera:
      '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
    hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1c-2 0-4-1-5-3l-4-5a1.6 1.6 0 0 1 2-2l2 2"/>',
    mouse:
      '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 3v6"/>',
    reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    cup: '<path d="M4 4h12v11a5 5 0 0 1-10 0V4m10 2h2a3 3 0 0 1 0 6h-2M3 21h16"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.01"/>',
    calibrate: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ""}</svg>`;
}

function handGuide() {
  const hand = `<path d="M57 164 52 132 34 108Q29 99 36 96Q41 94 47 102L57 115 54 62Q54 55 60 55Q66 55 67 63L70 96 71 38Q71 30 77 30Q84 30 84 38L85 94 90 42Q91 34 97 35Q104 36 103 44L100 99 108 62Q110 55 116 57Q122 59 120 67L113 118 105 145 106 164"/><path d="m57 115 20 5 23-21M70 96l1 25m14-27-1 25M57 164l49-19M78 120l-2 36"/><circle cx="78" cy="120" r="3"/><circle cx="70" cy="96" r="2"/><circle cx="85" cy="94" r="2"/><circle cx="100" cy="99" r="2"/>`;
  return `<svg class="hand-guide" viewBox="0 0 280 180" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g>${hand}</g><g transform="translate(280 0) scale(-1 1)">${hand}</g></svg>`;
}

export function mountInterface() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <header class="app-toolbar">
      <div class="wordmark">${icon("robot", 24)}<h1>Robo Chef</h1></div>
      <span class="workspace-name">Practice kitchen</span>
      <div class="toolbar-actions">
        <button id="pause" class="tool-button" title="Pause (Space)">${icon("pause")}<span>Pause</span></button>
        <button id="reset" class="tool-button" title="Reset table (R)">${icon("reset")}<span>Reset table</span></button>
        <span class="toolbar-divider"></span>
        <button id="help-open" class="icon-button" aria-label="Controls and shortcuts" title="Controls and shortcuts (?)">${icon("help")}</button>
      </div>
    </header>
    <main class="workbench">
      <aside class="input-panel" aria-label="Input controls">
        <div class="sidebar-scroll">
          <div class="input-heading"><h2>Input</h2><span id="camera-status" class="camera-status">Off</span></div>
          <div class="mode-switch" role="group" aria-label="Input mode">
            <button id="mode-hands" aria-pressed="false">${icon("hand")}Hands</button>
            <button id="mode-mouse" aria-pressed="true">${icon("mouse")}Mouse</button>
          </div>
          <div class="camera-view">
            <video id="video" playsinline muted></video><canvas id="overlay"></canvas>
            <div id="camera-empty">${handGuide()}<span>Camera is off</span></div>
            <div id="camera-live" hidden><span class="live-dot"></span>Mirrored</div>
          </div>
          <div class="camera-actions">
            <button id="start" class="button camera-button">${icon("camera")}Enable camera</button>
            <button id="stop" class="button disconnect-button" hidden>${icon("camera")}Turn off camera</button>
          </div>
          <p id="tracking-note" class="tracking-note" aria-live="polite">Enable your camera to use your hands.</p>
          <div class="hand-states" aria-label="Hand tracking status">
            <div id="hand-left"><span class="hand-name"><i></i>Left hand</span><b>Not connected</b></div>
            <div id="hand-right"><span class="hand-name"><i></i>Right hand</span><b>Not connected</b></div>
          </div>
          <button id="calibrate" class="button calibrate-button" disabled>${icon("calibrate")}Calibrate hands</button>
          <p id="calibration-note" class="calibration-note">Hold your palms open in a comfortable position.</p>
          <section class="task" aria-labelledby="mission-title">
            <div class="task-heading"><span>Practice</span><span id="task-status">0 / 2</span></div>
            <div class="task-title"><span class="cup-swatch">${icon("cup", 23)}</span><h2 id="mission-title">Place the cup</h2></div>
            <p id="mission-copy">Move the orange cup onto the circle on the board.</p>
            <ol class="task-steps"><li id="step-pick"><span class="step-check">${icon("check", 12)}</span>Pick up the cup</li><li id="step-place"><span class="step-check">${icon("check", 12)}</span>Set it on the board</li></ol>
          </section>
        </div>
        <div class="sidebar-foot">${icon("camera", 14)}Camera processing stays on your device.</div>
      </aside>
      <section class="kitchen-panel" aria-label="Robot view">
        <div class="viewport-toolbar"><h2>Robot view</h2><span id="input-status">Mouse control</span><button id="fullscreen" class="icon-button" aria-label="Focus kitchen" aria-pressed="false" title="Focus kitchen (F)">${icon("focus")}</button></div>
        <div id="scene">
          <div id="paused-overlay" hidden><div class="pause-symbol">${icon("pause", 25)}</div><h2>Paused</h2><button id="resume" class="button resume-button">${icon("play")}Resume</button><span>or press Space</span></div>
          <div class="scene-bottom"><span id="scene-hint">Move to reach. Hold to pick up.</span><div id="mouse-switch" role="group" aria-label="Active robot hand"><span>Hand</span><button data-side="Left" aria-label="Left hand" aria-pressed="false" title="Left hand (Q)">L</button><button data-side="Right" aria-label="Right hand" aria-pressed="true" title="Right hand (E)">R</button></div></div>
        </div>
      </section>
    </main>
    <footer class="statusbar"><span id="help">Move to reach · Hold to grab · Release to place</span><span class="statusbar-keys"><span><kbd>Space</kbd>Pause</span><span><kbd>R</kbd>Reset</span><span><kbd>F</kbd>Focus</span></span></footer>
    <dialog id="controls-dialog" aria-labelledby="controls-title"><div class="dialog-heading"><h2 id="controls-title">Controls</h2><button id="help-close" class="icon-button" aria-label="Close controls">${icon("close")}</button></div><div class="dialog-content"><h3>With your hands</h3><p>Enable your camera, show both open palms, then calibrate.</p><dl><div><dt>Reach</dt><dd>Move up in the camera view to reach farther.</dd></div><div><dt>Grab</dt><dd>Pinch or close your fingers near an object.</dd></div><div><dt>Release</dt><dd>Open your hand to place the object.</dd></div></dl><h3>With your mouse</h3><p>Move over the table. Hold the primary button to carry an object; release to place it.</p><div class="dialog-shortcuts"><span><kbd>Q</kbd>Left hand</span><span><kbd>E</kbd>Right hand</span><span><kbd>Space</kbd>Pause</span><span><kbd>R</kbd>Reset table</span><span><kbd>F</kbd>Focus kitchen</span></div></div></dialog>
    <div id="toast" role="status" hidden></div>`;
}
