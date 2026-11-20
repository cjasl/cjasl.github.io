/* ============================================================
   GROVE STREET // CJASL — script.js
   Web Audio ambient drone · Procedural perspective grid
   Session uptime · Terminal auto-typing
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. CANVAS — PROCEDURAL PERSPECTIVE MOVING GRID
     ============================================================ */

  const canvas = document.getElementById('grid-canvas');
  const ctx = canvas.getContext('2d');

  let cw = 0;
  let ch = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Grid animation state
  let gridOffset = 0;          // scroll offset along horizon
  const gridSpeed = 0.0016;    // speed of forward motion
  const HORIZON_RATIO = 0.58;  // horizon line position (fraction of height)
  const FOV_DEPTH = 1.6;       // perspective depth factor

  function resizeCanvas() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Draw the retro perspective grid.
   * Horizontal lines converge toward a vanishing point at the horizon.
   * Vertical lines fan out from that vanishing point.
   */
  function drawGrid(time) {
    ctx.clearRect(0, 0, cw, ch);

    const horizonY = ch * HORIZON_RATIO;
    const vanishX = cw / 2;

    // ---- Background gradient (sky above horizon) ----
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#0a0a0c');
    skyGrad.addColorStop(1, '#0d1210');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, cw, horizonY);

    // ---- Floor gradient (below horizon) ----
    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, ch);
    floorGrad.addColorStop(0, '#0d1210');
    floorGrad.addColorStop(1, '#080a08');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizonY, cw, ch - horizonY);

    // ---- Horizon glow line ----
    const glowGrad = ctx.createLinearGradient(0, horizonY - 6, 0, horizonY + 6);
    glowGrad.addColorStop(0, 'rgba(0, 255, 102, 0)');
    glowGrad.addColorStop(0.5, 'rgba(0, 255, 102, 0.55)');
    glowGrad.addColorStop(1, 'rgba(0, 255, 102, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, horizonY - 6, cw, 12);

    // ---- Horizontal perspective lines (moving toward viewer) ----
    const numHorizLines = 22;
    ctx.lineWidth = 1;

    for (let i = 0; i < numHorizLines; i++) {
      // t goes 0..1 for depth; animate via offset
      let t = (i / numHorizLines + gridOffset) % 1;

      // Use exponential mapping for perspective compression near horizon
      const perspective = Math.pow(t, FOV_DEPTH);
      const y = horizonY + perspective * (ch - horizonY);

      if (y < horizonY) continue;

      // Fade lines as they approach horizon
      const alpha = Math.min(1, perspective * 3.5) * 0.55;
      if (alpha < 0.01) continue;

      ctx.strokeStyle = 'rgba(0, 255, 102, ' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    // ---- Vertical lines fanning out from vanishing point ----
    const numVertLines = 26;
    const halfVerts = numVertLines / 2;
    ctx.lineWidth = 1;

    for (let i = -halfVerts; i <= halfVerts; i++) {
      // Base spread at bottom of screen
      const spreadX = i * (cw / numVertLines) * 2.4;
      const bottomX = vanishX + spreadX;

      // Fade based on how far from center
      const distFactor = 1 - Math.abs(i) / (halfVerts + 1);
      const alpha = (0.08 + distFactor * 0.32).toFixed(3);

      ctx.strokeStyle = 'rgba(0, 255, 102, ' + alpha + ')';
      ctx.beginPath();
      ctx.moveTo(vanishX, horizonY);
      ctx.lineTo(bottomX, ch);
      ctx.stroke();
    }

    // ---- Vanishing point subtle glow ----
    const vpGlow = ctx.createRadialGradient(
      vanishX, horizonY, 0,
      vanishX, horizonY, 120
    );
    vpGlow.addColorStop(0, 'rgba(0, 255, 102, 0.18)');
    vpGlow.addColorStop(1, 'rgba(0, 255, 102, 0)');
    ctx.fillStyle = vpGlow;
    ctx.fillRect(0, horizonY - 120, cw, 240);

    // Advance grid offset
    gridOffset = (gridOffset + gridSpeed) % 1;
  }

  /* ============================================================
     2. ANIMATION LOOP
     ============================================================ */

  function loop(timestamp) {
    drawGrid(timestamp);
    requestAnimationFrame(loop);
  }

  // Initialize canvas + start animation
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  requestAnimationFrame(loop);

  /* ============================================================
     3. WEB AUDIO — AMBIENT LOW-FREQUENCY SAWTOOTH DRONE
     ============================================================ */

  let audioCtx = null;
  let droneOsc = null;
  let droneGain = null;
  let droneFilter = null;
  let audioOn = false;

  const audioBtn = document.getElementById('audio-toggle');

  /**
   * Lazily create the AudioContext + drone graph.
   * 55 Hz sawtooth → lowpass 140 Hz → gain → destination.
   */
  function buildDroneGraph() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;

    audioCtx = new AC();

    // Oscillator: 55 Hz sawtooth (A1)
    droneOsc = audioCtx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.setValueAtTime(55, audioCtx.currentTime);

    // Low-pass filter at 140 Hz
    droneFilter = audioCtx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(140, audioCtx.currentTime);
    droneFilter.Q.setValueAtTime(6, audioCtx.currentTime);

    // Gain node (start at 0, fade in)
    droneGain = audioCtx.createGain();
    droneGain.gain.setValueAtTime(0, audioCtx.currentTime);

    // Connect: osc → filter → gain → destination
    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(audioCtx.destination);

    droneOsc.start();

    return true;
  }

  /**
   * Toggle ambient drone on/off with smooth gain ramps.
   */
  function toggleAudio() {
    if (!audioCtx) {
      const ok = buildDroneGraph();
      if (!ok) {
        audioBtn.textContent = '[SOUND: UNSUPPORTED]';
        audioBtn.disabled = true;
        return;
      }
    }

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;

    if (!audioOn) {
      // Fade in
      droneGain.gain.cancelScheduledValues(now);
      droneGain.gain.setValueAtTime(droneGain.gain.value, now);
      droneGain.gain.linearRampToValueAtTime(0.18, now + 0.8);
      audioOn = true;
      audioBtn.textContent = '[SOUND: ON]';
      audioBtn.setAttribute('aria-pressed', 'true');
    } else {
      // Fade out
      droneGain.gain.cancelScheduledValues(now);
      droneGain.gain.setValueAtTime(droneGain.gain.value, now);
      droneGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
      audioOn = false;
      audioBtn.textContent = '[SOUND: OFF]';
      audioBtn.setAttribute('aria-pressed', 'false');
    }
  }

  audioBtn.addEventListener('click', toggleAudio);

  /* ============================================================
     4. SESSION UPTIME TIMER (HH:MM:SS)
     ============================================================ */

  const uptimeEl = document.getElementById('uptime-display');
  const sessionStart = Date.now();

  function formatUptime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
  }

  function tickUptime() {
    if (uptimeEl) {
      uptimeEl.textContent = formatUptime(Date.now() - sessionStart);
    }
  }

  tickUptime();
  setInterval(tickUptime, 1000);

  /* ============================================================
     5. TERMINAL SIMULATOR — AUTO-TYPING LOG LINES
     ============================================================ */

  const terminalOutput = document.getElementById('terminal-output');
  const terminalCursor = document.getElementById('terminal-cursor');

  // Lines appear sequentially every 1.5 s
  const TERMINAL_LINES = [
    { text: 'init --verbose',                       isCommand: true },
    { text: '> loading kernel modules... OK',        isCommand: false },
    { text: '> mounting /dev/concrete ... OK',      isCommand: false },
    { text: '> arbitrage engine: M-CYCLE engaged',  isCommand: false },
    { text: '> thermals nominal (Δ 3.2K)',          isCommand: false },
    { text: '> encryption AES-256-GCM handshake OK',isCommand: false },
    { text: '> geo-lock: GACHSARAN // BUSHEHR',     isCommand: false },
    { text: '> status: SIX-GEARED, zero compromise',isCommand: false },
    { text: '> grove street is listening...',       isCommand: false }
  ];

  let lineIndex = 0;

  function appendTerminalLine(lineObj) {
    if (!terminalOutput) return;

    const lineEl = document.createElement('div');
    lineEl.className = 'terminal-line';

    const promptEl = document.createElement('span');
    promptEl.className = 'prompt';
    promptEl.textContent = 'cjasl@grovestreet:~$';

    const textEl = document.createElement('span');
    textEl.className = 'terminal-text';

    if (lineObj.isCommand) {
      textEl.textContent = lineObj.text;
    } else {
      // Wrap the leading '>' in highlight span
      const raw = lineObj.text;
      if (raw.charAt(0) === '>') {
        const hl = document.createElement('span');
        hl.className = 'highlight';
        hl.textContent = '>';
        textEl.appendChild(hl);
        textEl.appendChild(document.createTextNode(raw.slice(1)));
      } else {
        textEl.textContent = raw;
      }
    }

    lineEl.appendChild(promptEl);
    lineEl.appendChild(textEl);

    // Insert before the cursor line (cursor stays last)
    terminalOutput.insertBefore(lineEl, terminalCursor.parentNode);

    // Auto-scroll terminal
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function startTerminalSequence() {
    // The first line is already in HTML; start from index 1
    lineIndex = 1;

    const interval = setInterval(function () {
      if (lineIndex >= TERMINAL_LINES.length) {
        clearInterval(interval);
        return;
      }
      appendTerminalLine(TERMINAL_LINES[lineIndex]);
      lineIndex++;
    }, 1500);
  }

  // Kick off after a short initial delay
  setTimeout(startTerminalSequence, 900);

})();
