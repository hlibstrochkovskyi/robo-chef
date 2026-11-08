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

export function mountInterface() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <header class="app-toolbar">
      <h1>Robo Chef</h1>
      <div class="toolbar-actions">
        <button id="pause" class="tool-button" title="Pause (Space)">${icon("pause", 16)}<span>Pause</span></button>
        <button id="reset" class="tool-button" title="Reset table (R)">${icon("reset", 16)}<span>Reset</span></button>
        <span class="toolbar-divider"></span>
        <button id="fullscreen" class="icon-button" aria-label="Focus kitchen" aria-pressed="false" title="Focus kitchen (F)">${icon("focus", 16)}</button>
        <button id="help-open" class="icon-button" aria-label="Controls and shortcuts" title="Controls (?)">${icon("help", 16)}</button>
      </div>
    </header>
    <main class="workbench">
      <section class="input-panel" aria-label="Camera view">
        <div class="panel-toolbar"><h2>Camera</h2><span id="camera-status">Off</span><button id="stop" class="small-button" hidden>Stop camera</button></div>
        <div class="camera-view">
          <video id="video" playsinline muted></video><canvas id="overlay"></canvas>
          <div id="camera-empty">${icon("camera", 28)}<h3 id="camera-title">Camera off</h3><button id="start" class="button primary-button">Start camera</button></div>
          <div id="camera-live" hidden>Mirrored</div>
          <div id="hand-states" hidden><span id="hand-left">Left <b>—</b></span><span id="hand-right">Right <b>—</b></span></div>
        </div>
        <div class="camera-footer"><p id="tracking-note" role="status">Mouse control</p><button id="calibrate" class="small-button" title="Hold your palms open, then calibrate" disabled hidden>${icon("calibrate", 15)}Calibrate</button></div>
      </section>
      <div id="splitter" role="separator" tabindex="0" aria-label="Resize camera" aria-orientation="vertical" aria-valuemin="240" aria-valuemax="600" aria-valuenow="360"></div>
      <section class="kitchen-panel" aria-label="Robot view">
        <div class="panel-toolbar"><h2>Kitchen</h2><div id="mouse-switch" role="group" aria-label="Active robot hand"><span>Mouse</span><button data-side="Left" aria-label="Left hand" aria-pressed="false" title="Left hand (Q)">L</button><button data-side="Right" aria-label="Right hand" aria-pressed="true" title="Right hand (E)">R</button></div></div>
        <div id="scene"><div id="paused-overlay" hidden><h2>Paused</h2><button id="resume" class="button primary-button">${icon("play", 16)}Resume</button></div></div>
      </section>
    </main>
    <dialog id="controls-dialog" aria-labelledby="controls-title"><div class="dialog-heading"><h2 id="controls-title">Controls</h2><button id="help-close" class="icon-button" aria-label="Close controls">${icon("close")}</button></div><div class="dialog-content"><h3>Camera</h3><p>Show both open palms steadily for a moment, then calibrate. Open your hand once to enable grabbing.</p><dl><div><dt>Reach</dt><dd>Move closer to the camera to reach farther. Depth is approximate; side-on palms freeze depth.</dd></div><div><dt>Lift</dt><dd>Raise your hand to lift the robot hand.</dd></div><div><dt>Grab</dt><dd>Pinch or make a full fist near a mug handle.</dd></div><div><dt>Release</dt><dd>Open your hand to place the object.</dd></div></dl><h3>Mouse</h3><p>With the camera off, move over the table. Hold the primary button to carry an object; release to place it.</p><div class="dialog-shortcuts"><span><kbd>Q</kbd>Left hand</span><span><kbd>E</kbd>Right hand</span><span><kbd>Space</kbd>Pause</span><span><kbd>R</kbd>Reset</span><span><kbd>F</kbd>Focus</span><span><kbd>F8</kbd>Diagnostics</span></div></div></dialog>
    <div id="toast" role="status" hidden></div>`;
}
