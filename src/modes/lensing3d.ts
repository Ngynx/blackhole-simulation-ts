import { createGpuRenderer, type CameraState, type GpuRenderer } from '../render/gpuRenderer';

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
 * occludes it, and how much it covers depends on the viewing angle. That is
 * also why the self-check's SHADOW_DIAMETER moved from 144 to 118 when this
 * was raised; see the note there.
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
  options: Options = {},
): Promise<Lensing3D> {
  const renderer: GpuRenderer = await createGpuRenderer(device, canvas);

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

  let checked = false;

  function frame(): void {
    if (dirty) {
      dirty = false;
      renderer.resize();
      const aspect = canvas.height > 0 ? canvas.width / canvas.height : 1;
      renderer.render(buildCamera(distance, azimuth, elevation, aspect));

      if (options.selfCheck && !checked) {
        checked = true;
        void renderer.measureShadowDiameter().then((diameter) => {
          // Single greppable line: the headless harness reads this from the
          // browser console instead of parsing a PNG.
          //
          // This measures the *visible* black run on the centre row of the
          // compute texture, not the capture silhouette. Before the disk
          // existed it was that silhouette (144 px against 147 predicted).
          // Now the disk's near side covers part of it -- and, per the
          // reference's loop order, a photon that crosses the disk annulus
          // before it reaches the capture radius is reported as disk rather
          // than as captured, exactly as geodesic.comp's `hitDisk` break does.
          // So 118 px is the expected figure, not a regression: it is roughly
          // the disk's inner edge (2.2 rs) projected at distance 40 rs, which
          // is 121 px by the same arithmetic the 147 was derived from.
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
    if (e.key === 'r' || e.key === 'R') resetCamera();
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
