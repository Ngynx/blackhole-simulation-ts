/**
 * WebGPU bootstrap.
 *
 * Isolates every step that can fail on a real machine (missing API, blocked
 * adapter, device loss) so the UI can show one honest, human-readable reason
 * instead of an opaque console stack trace.
 *
 * WGSL shaders live in `src/shaders/*.wgsl` and are imported with Vite's
 * native `?raw` suffix, e.g. `import geodesic from '../shaders/geodesic.wgsl?raw'`.
 * That keeps shader source out of TypeScript string literals.
 */

/** Minimal structural view of GPUAdapterInfo (spec-shaped, not type-locked). */
interface AdapterInfoLike {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

export type WebGPUProbe =
  | { ok: true; adapter: GPUAdapter; device: GPUDevice; info: string }
  | { ok: false; reason: string };

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function adapterInfoText(adapter: GPUAdapter): string {
  const info = (adapter as { info?: AdapterInfoLike }).info;
  if (!info) return 'adapter info unavailable';
  const parts = [info.vendor, info.architecture, info.device, info.description].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  return parts.length > 0 ? parts.join(' · ') : 'adapter info unavailable';
}

/**
 * Probes WebGPU end to end.
 *
 * Returns a discriminated result rather than throwing, because "WebGPU is not
 * available" is an expected outcome on browsers without support (Safari without
 * the feature flag, Firefox, etc.) and the app must degrade gracefully.
 */
export async function probeWebGPU(): Promise<WebGPUProbe> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator) || !navigator.gpu) {
    return {
      ok: false,
      reason: 'navigator.gpu is undefined — this browser has no WebGPU support',
    };
  }

  let adapter: GPUAdapter | null;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch (err) {
    return { ok: false, reason: `requestAdapter() failed: ${describeError(err)}` };
  }
  if (!adapter) {
    return { ok: false, reason: 'No GPU adapter available (the OS or driver refused WebGPU)' };
  }

  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch (err) {
    return { ok: false, reason: `requestDevice() rejected: ${describeError(err)}` };
  }

  // Shader and pipeline failures in WebGPU are asynchronous: they surface as
  // `uncapturederror` events, never as thrown exceptions, so without this
  // listener a broken shader silently renders black and looks like a camera or
  // physics bug instead of a compile error.
  device.addEventListener('uncapturederror', (event) => {
    console.error(`WebGPU validation: ${event.error.message}`);
  });

  return { ok: true, adapter, device, info: adapterInfoText(adapter) };
}

/**
 * Attaches the canvas to the device. `alphaMode: 'premultiplied'` lets later
 * passes blend over the page background without a second composite pass.
 */
export function configureCanvasContext(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
): GPUCanvasContext {
  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('canvas.getContext("webgpu") returned null — the canvas is already claimed by another context');
  }
  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
    alphaMode: 'premultiplied',
  });
  return context;
}

/**
 * Applies CSS-pixel size x devicePixelRatio to the drawing buffer and returns
 * the backing-store size. WebGPU draws in device pixels, so the canvas
 * `width`/`height` attributes must be scaled or the image renders blurry.
 */
export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): { width: number; height: number } {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}
