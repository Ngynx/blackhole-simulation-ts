import { createGpuRenderer, type CameraState, type GpuRenderer } from '../render/gpuRenderer';
import { nextStyle, toggleCrt } from '../render/styleSelect';
import { applyUiStyle } from '../render/uiStyle';
import type { Style } from '../render/style';

/**
 * Phase 2: 3D lensing rendered by a WGSL compute shader.
 *
 * The camera orbits the hole and every pixel launches a photon that is traced
 * backwards through the Schwarzschild geometry (see geodesic3d.wgsl). Pixels
 * whose ray falls in come back black, which is the shadow; pixels whose ray
 * escapes sample the procedural sky along the ray's final velocity direction,
 * so the background visibly bends around the hole.
 *
 * Phase 3 adds two things to that image: an accretion disk (the annulus in the
 * y = 0 plane the march now tests for crossings) and the Flamm-paraboloid
 * wireframe, overlaid by a third render pass.
 */

/** Starting distance from the hole, in rs. Far enough that the shadow is small. */
const DEFAULT_DIST = 40;
const DEFAULT_AZIMUTH = -0.55;

/**
 * Elevation above the equatorial plane, radians.
 *
 * The reference starts at exactly 90 degrees of elevation in its own
 * convention, which puts its camera *in* the disk plane -- an edge-on view
 * where both the disk and the curvature sheet collapse to a line. At 0.18 rad
 * ours was only 10 degrees, enough to flatten the lattice to a thin band.
 * 0.5 rad (about 29 degrees) opens the annulus into a readable ellipse.
 *
 * The shadow's *intrinsic* silhouette does not depend on elevation -- it is
 * spherical -- but the shadow we can see does: the near side of the disk
 * occludes it, and how much it covers depends on the viewing angle. So the
 * self-check's SHADOW_DIAMETER is not a fixed figure either; see the note
 * there for what it actually measures and reports.
 */
const DEFAULT_ELEVATION = 0.5;

/** Vertical field of view. The shadow must stay on screen at the default distance. */
const FOV_Y = (40 * Math.PI) / 180;

/** Dolly limits. The camera can never enter the horizon, nor retreat so far
 *  that the shadow drops below one pixel. */
const MIN_DIST = 6;
const MAX_DIST = 400;

/** Elevation is clamped well short of the poles, where the camera's "up"
 *  axis degenerates and the look-at basis stops being well defined. */
const MAX_ELEVATION = (85 * Math.PI) / 180;

const WORLD_UP: readonly [number, number, number] = [0, 1, 0];

/**
 * The on-screen key-binding hint for 3D mode, built from the active style so
 * it always names that style and documents what `c` means for it.
 *
 * Product choice, stated on screen as well as here: `s` switches presets, `c`
 * toggles only the CRT layer (scanlines + vignette) while the retro core
 * (palette + dither) is left alone -- and in `realistic`, which ships no core
 * flags, `c` deliberately does nothing ("retro only"), because switching the
 * CRT flags on over a non-quantised image is a look no preset asked for.
 */
export function lensing3dHint(style: Style): string {
  const crt =
    style.post.palette || style.post.dither
      ? 'c: crt (scanlines+vignette, palette+dither stay)'
      : 'c: crt (retro only)';
  return `drag: orbit · wheel: zoom · r: reset view · s: style (${style.name}) · ${crt}`;
}

export interface Lensing3D {
  destroy(): void;
  resize(): void;
}

interface Options {
  /**
   * After the first frame, read the render back and print the measured width
   * of the black disc. Used by the headless verification harness to compare
   * against the predicted shadow diameter; costs one buffer readback, so it is
   * opt-in via `?check=1`.
   */
  selfCheck?: boolean;
  /**
   * The style selected at startup (main.ts resolves `?style=` through
   * `initialStyleFrom`). Required: the caller owns selection, this mode owns
   * application -- the renderer, the page chrome and the hint all start from
   * exactly this object.
   */
  style: Style;
  /** The hint element (`#hint`). This mode keeps its text in sync with the
   *  active style on every switch; omitted, the hint simply stays as it is. */
  hint?: HTMLElement | null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: readonly [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * Places the camera and builds an orthonormal view basis.
 *
 * `right = fwd × worldUp` is the convention that matches the blit shader's
 * screen axes (x right, y up); flipping it would mirror the image.
 */
function buildCamera(
  distance: number,
  azimuth: number,
  elevation: number,
  aspect: number,
): CameraState {
  const cosEl = Math.cos(elevation);
  const pos: [number, number, number] = [
    distance * cosEl * Math.cos(azimuth),
    distance * Math.sin(elevation),
    distance * cosEl * Math.sin(azimuth),
  ];
  const fwd = normalize([-pos[0], -pos[1], -pos[2]]);
  const right = normalize(cross(fwd, WORLD_UP));
  const up = cross(right, fwd);

  return {
    pos,
    right,
    up,
    fwd,
    tanHalfFov: Math.tan(FOV_Y / 2),
    aspect,
  };
}

export async function createLensing3d(
  canvas: HTMLCanvasElement,
  device: GPUDevice,
  options: Options,
): Promise<Lensing3D> {
  // Single owner of "what the app looks like right now". Every switch goes
  // through activateStyle() below, so renderer uniforms, page chrome, hint
  // text and render scale can never disagree about the current style.
  let currentStyle: Style = options.style;
  const renderer: GpuRenderer = await createGpuRenderer(device, canvas, currentStyle);

  // Page chrome + hint start from the same style the renderer got. The values
  // applyUiStyle() writes here equal index.html's :root declarations (locked
  // by uiStyle.test.ts), so the default load renders unchanged -- doing it
  // anyway keeps one code path responsible for the chrome on every switch.
  applyUiStyle(currentStyle);
  if (options.hint) options.hint.textContent = lensing3dHint(currentStyle);

  // Declared before any helper runs: resetCamera() marks the first frame dirty.
  let dirty = true;
  let rafId = 0;
  let distance = DEFAULT_DIST;
  let azimuth = DEFAULT_AZIMUTH;
  let elevation = DEFAULT_ELEVATION;

  function resetCamera(): void {
    distance = DEFAULT_DIST;
    azimuth = DEFAULT_AZIMUTH;
    elevation = DEFAULT_ELEVATION;
    requestRedraw();
  }

  resetCamera();

  function requestRedraw(): void {
    dirty = true;
  }

  /**
   * Applies a style everywhere it is visible: renderer uniforms + offscreen
   * retarget (`setStyle`), page chrome (`applyUiStyle`), hint text, redraw.
   *
   * An identity switch is skipped on purpose: `toggleCrt` returns the SAME
   * object for `c` in the realistic style (no CRT core to toggle), so the
   * no-op never rewrites a buffer, never re-sets a CSS property and never
   * touches the frame.
   */
  function activateStyle(next: Style): void {
    if (next === currentStyle) return;
    currentStyle = next;
    renderer.setStyle(next);
    applyUiStyle(next);
    if (options.hint) options.hint.textContent = lensing3dHint(next);
    requestRedraw();
  }

  let checked = false;

  function frame(): void {
    if (dirty) {
      dirty = false;
      renderer.resize();
      const aspect = canvas.height > 0 ? canvas.width / canvas.height : 1;
      renderer.render(buildCamera(distance, azimuth, elevation, aspect));

      if (options.selfCheck && !checked) {
        checked = true;
        void renderer.measureShadowDiameterCanvasPx().then((diameter) => {
          // Single greppable line: the headless harness reads this from the
          // browser console instead of parsing a PNG.
          //
          // This measures the *visible* black run on the centre row of the
          // compute texture, not the capture silhouette: a count across the
          // middle row of the shadow, in CANVAS pixels. Per the reference's
          // loop order a photon that crosses the disk annulus before it
          // reaches the capture radius is reported as disk rather than as
          // captured (geodesic.comp's `hitDisk` break), and the disk's near
          // side covers part of the silhouette as well -- so the run is
          // shorter than the capture diameter, and it is NOT a fixed figure.
          //
          // The count is viewport-dependent: it scales with the canvas the
          // browser gives us, so there is no single expected number to pin.
          // The `?check=1` harness reports what was actually measured. In a
          // 756x469 headless viewport it reads 84, at renderScale 1 and at
          // the retro preset's 0.25 alike.
          //
          // The unit is CANVAS pixels at any renderScale: the renderer counts
          // storage texels and converts at its API boundary, so the reported
          // value stays comparable while the retro preset renders at 0.25.
          console.log(`SHADOW_DIAMETER=${diameter}`);
        });
      }
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
    azimuth -= dx * 0.005;
    elevation = clamp(elevation + dy * 0.005, -MAX_ELEVATION, MAX_ELEVATION);
    requestRedraw();
  };

  const onPointerUp = (e: PointerEvent): void => {
    dragging = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    distance = clamp(distance * Math.exp(e.deltaY * 0.001), MIN_DIST, MAX_DIST);
    requestRedraw();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'r' || e.key === 'R') {
      resetCamera();
    } else if (e.key === 's' || e.key === 'S') {
      // Style toggle, 3D mode only: lensing2d.ts owns its own key handling
      // and knows nothing about styles.
      activateStyle(nextStyle(currentStyle));
    } else if (e.key === 'c' || e.key === 'C') {
      // CRT layer only (scanlines + vignette); the retro core stays as-is,
      // and in the realistic style this is a documented no-op.
      activateStyle(toggleCrt(currentStyle));
    }
  };

  const observer = new ResizeObserver(() => requestRedraw());

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
      renderer.destroy();
    },
    resize() {
      requestRedraw();
    },
  };
}
