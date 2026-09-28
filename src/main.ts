import { createLensing2D } from './modes/lensing2d';
import { createLensing3d } from './modes/lensing3d';
import { probeWebGPU, type WebGPUProbe } from './render/webgpu';

const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const fallbackEl = document.getElementById('fallback');

/** Narrowing helper: every later use site gets a concrete HTMLCanvasElement. */
function requireCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`#${id} canvas is missing from index.html`);
  }
  return el;
}
const canvas = requireCanvas('view');

/** Which simulation mode the URL asks for. Unknown values fall back to 2D. */
type Mode = '2d' | '3d';
function requestedMode(): { mode: Mode; known: boolean } {
  const raw = new URLSearchParams(window.location.search).get('mode');
  if (raw === '3d') return { mode: '3d', known: true };
  if (raw === '2d') return { mode: '2d', known: true };
  if (raw === null) return { mode: '2d', known: true };
  return { mode: '2d', known: false };
}

function setStatus(probe: WebGPUProbe, note = ''): void {
  if (!statusEl) return;
  statusEl.classList.remove('ok', 'fail');
  if (probe.ok) {
    statusEl.classList.add('ok');
    statusEl.textContent = `WebGPU ready — ${probe.info}${note}`;
  } else {
    statusEl.classList.add('fail');
    statusEl.textContent = `WebGPU unavailable — ${probe.reason}.${note}`;
  }
}

function showFallback(reason: string): void {
  if (fallbackEl) {
    fallbackEl.textContent =
      `This mode requires WebGPU, which is not available in this browser.\n\n${reason}\n\n` +
      'Use a current Chrome or Edge on macOS, or open the 2D lensing demo with ?mode=2d.';
  }
  if (statusEl) statusEl.style.display = 'none';
  if (hintEl) hintEl.style.display = 'none';
  canvas.style.display = 'none';
}

async function main(): Promise<void> {
  const { mode, known } = requestedMode();
  const probe = await probeWebGPU();

  let note = !known ? ' Unknown mode value — falling back to 2D.' : '';
  setStatus(probe, note);

  if (mode === '3d') {
    if (!probe.ok) {
      showFallback(probe.reason);
      return;
    }

    // The self-check readback is opt-in: it costs one texture round-trip and
    // exists purely so the headless verification harness can measure the
    // shadow radius without parsing a screenshot.
    const selfCheck = new URLSearchParams(window.location.search).get('check') === '1';
    if (hintEl) hintEl.textContent = 'drag: orbit · wheel: zoom · r: reset view';

    try {
      await createLensing3d(canvas, probe.device, { selfCheck });
    } catch (err) {
      showFallback(err instanceof Error ? err.message : String(err));
    }
    return;
  }

  if (hintEl) {
    hintEl.textContent = 'drag: pan · wheel: zoom · r: reset view';
  }

  createLensing2D(canvas);
}

void main();
