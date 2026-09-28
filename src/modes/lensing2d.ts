import { RS } from '../physics/constants';
import { traceRay } from '../physics/geodesic';
import { resizeCanvasToDisplaySize } from '../render/webgpu';

/**
 * Phase 1: 2D gravitational lensing rendered on a Canvas2D context.
 *
 * A parallel fan of photons is integrated once through the Schwarzschild
 * geometry and the resulting trajectories are drawn as coloured trails. The
 * whole point of the demo is visual: rays with small impact parameter swing
 * hard around the hole, rays with large impact parameter barely notice it,
 * and rays below the photon-sphere limit never come back out.
 */

/**
 * Number of parallel rays in the fan. Kept low enough that individual rays
 * stay legible: 81 rays over 24 rs are ~0.3 rs apart, about 4 px at the
 * default zoom. A denser fan turns into a solid smear instead of a lens.
 */
const RAY_COUNT = 81;
/** Impact-parameter range of the fan, in units of rs. */
const B_MIN = -12;
const B_MAX = 12;
/** Where the fan is launched; x = -45 rs is off the left edge of the default view. */
const LAUNCH_X = -45;

/** Default camera framing: 100 rs wide by 32 rs tall, centred on the hole. */
const VIEW_W = 100;
const VIEW_H = 32;

/**
 * Trail segments are drawn in bands because Canvas2D has no per-vertex alpha.
 * A band ends once its opacity would drift from the running value by more
 * than this, so bands line up with world-space x instead of with point index.
 */
const ALPHA_STEP = 0.05;
/** Brightest alpha, at the hole; far-field trails fade so the lensing reads. */
const ALPHA_NEAR = 0.95;
const ALPHA_FAR = 0.18;
/** Distance in rs at which a trail reaches its faintest alpha. */
const ALPHA_FALLOFF = 50;

/**
 * Apparent radius of the black hole, in rs.
 *
 * NOT the event horizon (rs = 1): light bending lets an outside observer see
 * a larger dark disc. Every photon with impact parameter below the critical
 * value b_c = 3·√3/2 · rs ≈ 2.598 rs is captured no matter where it started,
 * so that is the silhouette that actually shows up on screen. Drawing the
 * horizon instead would leave a bright ring of captured-ray endpoints
 * sticking out past the shadow.
 */
const SHADOW_R = ((3 * Math.sqrt(3)) / 2) * RS;

/**
 * Opacity as a function of WORLD position, not of progress along the trail.
 *
 * Keying alpha to trail fraction (as a naive comet-tail fade would) makes the
 * visible extent depend on how long that particular ray ran, and trail length
 * depends on the impact parameter -- so escaping rays would fade out on screen
 * while captured rays stayed bright, drawing a fake boundary that has nothing
 * to do with the physics. Keying it to x gives every ray the same treatment
 * and puts the emphasis exactly where the lensing happens.
 */
function alphaAt(x: number): number {
  const t = Math.min(1, Math.abs(x) / ALPHA_FALLOFF);
  return ALPHA_NEAR - (ALPHA_NEAR - ALPHA_FAR) * t * t;
}

/**
 * Minimum world-space distance between two recorded trail points, in rs.
 * Keeps the polyline dense enough to look smooth near the hole without
 * shipping every single RK4 step to the stroker.
 */
const MIN_SPACING = 0.25;
/**
 * Chord tolerance grows with distance from the hole. A ray's curvature falls
 * off roughly as 1/r, so far-field segments are effectively straight and can
 * be spaced widely without changing the rendered shape; near the hole the
 * spacing collapses to MIN_SPACING so the swing stays smooth.
 */
const SPACING_SLOPE = 0.06;

function spacingAt(x: number, y: number): number {
  return Math.max(MIN_SPACING, SPACING_SLOPE * Math.hypot(x, y));
}

/** One integrated photon trajectory, ready to be stroked. */
export interface Trail {
  /** Impact parameter b of this ray, in rs. */
  b: number;
  /** Flat [x0, y0, x1, y1, ...] trail samples in world units (rs). */
  pts: number[];
}

interface Camera {
  /** World-space point that sits at the centre of the canvas, in rs. */
  offsetX: number;
  offsetY: number;
  /** Pixels per rs. */
  scale: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Sub-samples a dense trace so consecutive points are at least `minDist` apart. */
function downsample(flat: number[]): number[] {
  if (flat.length <= 4) return flat.slice();
  const out: number[] = [flat[0], flat[1]];
  let lx = flat[0];
  let ly = flat[1];
  for (let i = 2; i < flat.length; i += 2) {
    const x = flat[i];
    const y = flat[i + 1];
    // Use the tighter of the two endpoint budgets so a segment arriving at
    // the hole from far away never skips points it still needs.
    const budget = Math.min(spacingAt(lx, ly), spacingAt(x, y));
    if (Math.hypot(x - lx, y - ly) >= budget) {
      out.push(x, y);
      lx = x;
      ly = y;
    }
  }
  // Always keep the true terminus (horizon crossing or escape point).
  const n = flat.length;
  if (out[out.length - 2] !== flat[n - 2] || out[out.length - 1] !== flat[n - 1]) {
    out.push(flat[n - 2], flat[n - 1]);
  }
  return out;
}

/** Colour-codes a trail by its impact parameter (blue at b = -12, magenta at b = +12). */
function trailColor(b: number): string {
  const t = (b - B_MIN) / (B_MAX - B_MIN);
  return `hsl(${190 + t * 130} 72% 68%)`;
}

function fitScale(cssWidth: number, cssHeight: number): number {
  return Math.min(cssWidth / VIEW_W, cssHeight / VIEW_H);
}

export interface Lensing2D {
  /** Tears down listeners and stops the animation loop. */
  destroy(): void;
  /** Re-reads the canvas size and marks the frame dirty. */
  resize(): void;
  /** Marks the next frame for repaint (camera change, first frame). */
  requestRedraw(): void;
}

/** Narrowing helper: keeps `ctx` non-nullable inside every nested draw function. */
function requireContext(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = target.getContext('2d');
  if (!c) throw new Error('2D canvas context unavailable');
  return c;
}

/**
 * Integrates the whole parallel-ray fan through the Schwarzschild geometry.
 *
 * Pure and DOM-free so it can be measured and tested outside a browser. This
 * runs exactly once per session: pan/zoom only change the camera transform,
 * never the physics.
 */
export function buildLensTrails(): Trail[] {
  const trails: Trail[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const b = B_MIN + ((B_MAX - B_MIN) * i) / (RAY_COUNT - 1);
    const { samples } = traceRay({ x: LAUNCH_X, y: b }, { x: 1, y: 0 });
    trails.push({ b, pts: downsample(samples) });
  }
  return trails;
}

export function createLensing2D(canvas: HTMLCanvasElement): Lensing2D {
  const ctx = requireContext(canvas);

  // --- Integration: runs exactly once. Pan/zoom only changes the transform. ---
  const trails = buildLensTrails();

  // Declared before any camera helper runs: resetCamera() marks the first
  // frame dirty, so the flag must already exist (temporal dead zone).
  let dirty = true;
  let rafId = 0;

  // --- Camera ---
  let cam: Camera = { offsetX: 0, offsetY: 0, scale: 1 };

  function worldToScreen(x: number, y: number, w: number, h: number): { sx: number; sy: number } {
    return {
      sx: w / 2 + (x - cam.offsetX) * cam.scale,
      sy: h / 2 - (y - cam.offsetY) * cam.scale,
    };
  }

  function screenToWorld(sx: number, sy: number, w: number, h: number): { x: number; y: number } {
    return {
      x: cam.offsetX + (sx - w / 2) / cam.scale,
      y: cam.offsetY - (sy - h / 2) / cam.scale,
    };
  }

  function resetCamera(): void {
    cam = {
      offsetX: 0,
      offsetY: 0,
      scale: fitScale(canvas.clientWidth || VIEW_W, canvas.clientHeight || VIEW_H),
    };
    requestRedraw();
  }

  resetCamera();

  function draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    resizeCanvasToDisplaySize(canvas);

    // Everything below is authored in CSS pixels; the backing store is dpr-scaled.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);

    // Trails first, horizon last: captured rays terminate inside r = rs and
    // must disappear under the disc instead of being stroked on top of it.
    drawTrails(w, h);
    drawBlackHole(w, h);
  }

  function drawBlackHole(w: number, h: number): void {
    const centre = worldToScreen(0, 0, w, h);
    const radius = SHADOW_R * cam.scale;

    // The shadow, not the horizon (see SHADOW_R): pure black interior with a
    // faint rim so it stays legible against the near-black background.
    ctx.beginPath();
    ctx.arc(centre.sx, centre.sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#3a3f4a';
    ctx.stroke();
  }

  function drawTrails(w: number, h: number): void {
    ctx.lineWidth = window.devicePixelRatio >= 2 ? 1.5 : 1;

    for (const trail of trails) {
      const pts = trail.pts;
      const n = pts.length / 2;
      if (n < 2) continue;

      ctx.strokeStyle = trailColor(trail.b);

      // Band by WORLD x, not by point index. Trails are sampled densely near
      // the hole and sparsely far away, so an index-th chunk can span from
      // x = 0 to x = 200 and would be stroked at a single wrong opacity --
      // that is what produced the visible rectangular seams. Cutting a band
      // whenever the opacity would drift by more than ALPHA_STEP keeps every
      // band on a world-space x slice, and the slice steps are small enough
      // to be invisible.
      let bandAlpha = alphaAt(pts[0]);
      ctx.globalAlpha = bandAlpha;
      ctx.beginPath();
      let anchor = worldToScreen(pts[0], pts[1], w, h);
      ctx.moveTo(anchor.sx, anchor.sy);

      for (let i = 1; i < n; i++) {
        const a = alphaAt(pts[2 * i]);
        if (Math.abs(a - bandAlpha) > ALPHA_STEP) {
          // Close the band on the previous point, then reopen it there so the
          // polyline stays continuous across the seam.
          anchor = worldToScreen(pts[2 * (i - 1)], pts[2 * (i - 1) + 1], w, h);
          ctx.lineTo(anchor.sx, anchor.sy);
          ctx.stroke();
          bandAlpha = a;
          ctx.globalAlpha = bandAlpha;
          ctx.beginPath();
          ctx.moveTo(anchor.sx, anchor.sy);
        }
        const p = worldToScreen(pts[2 * i], pts[2 * i + 1], w, h);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function requestRedraw(): void {
    dirty = true;
  }

  function frame(): void {
    if (dirty) {
      dirty = false;
      draw();
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  // --- Input ---
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onPointerDown = (e: PointerEvent): void => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    // Screen +y is down, world +y is up, so panning the content right means
    // moving the camera centre left.
    cam.offsetX -= dx / cam.scale;
    cam.offsetY += dy / cam.scale;
    requestRedraw();
  };

  const onPointerUp = (e: PointerEvent): void => {
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const base = fitScale(canvas.clientWidth || VIEW_W, canvas.clientHeight || VIEW_H);

    const before = screenToWorld(sx, sy, canvas.clientWidth, canvas.clientHeight);
    cam.scale = clamp(cam.scale * Math.exp(-e.deltaY * 0.0015), base * 0.2, base * 10);
    const after = screenToWorld(sx, sy, canvas.clientWidth, canvas.clientHeight);

    // Keep the world point under the cursor fixed while zooming.
    cam.offsetX += before.x - after.x;
    cam.offsetY += before.y - after.y;
    requestRedraw();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'r' || e.key === 'R') resetCamera();
  };

  const observer = new ResizeObserver(() => {
    requestRedraw();
  });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  observer.observe(canvas);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      observer.disconnect();
    },
    resize() {
      requestRedraw();
    },
    requestRedraw,
  };
}
