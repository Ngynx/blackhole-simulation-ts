import { createLensing2D } from './modes/lensing2d';
import { createLensing3d } from './modes/lensing3d';
import { initialStyleFrom, styleWarningNote, type QueryLike } from './render/styleSelect';
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
function requestedMode(params: QueryLike): { mode: Mode; known: boolean } {
  const raw = params.get('mode');
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
  const params = new URLSearchParams(window.location.search);
  const { mode, known } = requestedMode(params);
  const probe = await probeWebGPU();

  // Style selection is 3D-mode only: the 2D canvas draws without style
  // uniforms, so `?style=` is meaningless there -- and so is a warning about
  // one. An invalid value still never crashes: initialStyleFrom() has already
  // fallen back to the default and only reports `known: false`.
  const initialStyle = initialStyleFrom(params);

  let note = !known ? ' Unknown mode value — falling back to 2D.' : '';
  note += styleWarningNote(mode, initialStyle.known);
  setStatus(probe, note);

  if (mode === '3d') {
    if (!probe.ok) {
      showFallback(probe.reason);
      return;
    }

    // The self-check readback is opt-in: it costs one texture round-trip and
    // exists purely so the headless verification harness can measure the
    // shadow radius without parsing a screenshot.
    const selfCheck = params.get('check') === '1';

    try {
      // createLensing3d owns the style from here on: it hands the preset to
      // the renderer, applies the chrome and keeps the hint in sync while the
      // s/c keys switch styles.
      await createLensing3d(canvas, probe.device, {
        selfCheck,
        style: initialStyle.style,
        hint: hintEl,
      });
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
