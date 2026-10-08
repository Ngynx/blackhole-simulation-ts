import { RS } from './constants';

/**
 * Null geodesics around a Schwarzschild black hole in 3D.
 *
 * Every photon orbit lies in a plane through the centre (the spacetime is
 * spherically symmetric, so the orbital-plane normal L is conserved). That is
 * the whole trick of this module: instead of integrating (r, theta, phi) in
 * full 3D, we build the plane ONCE from the launch position and direction and
 * then integrate the same 2D system as `geodesic.ts`. The 3D position is
 * recovered on demand by rotating back into that plane.
 *
 * This file is the CPU reference for `src/shaders/geodesic3d.wgsl`. The shader
 * implements exactly these equations, so the tests below are the correctness
 * evidence for the GPU path too: if these numbers are wrong, the shader is
 * wrong, and vice versa.
 *
 * ENERGY-REDUCED FORM
 * --------------------
 * Rather than carrying E and f explicitly (which is where the upstream project
 * went wrong twice), we normalise the conserved energy to E = 1 and reduce the
 * radial equation to a single second-order ODE. Starting from the first
 * integral of a null geodesic,
 *
 *     (dr/dl)^2 = E^2 - f L^2 / r^2,      f = 1 - rs/r
 *
 * differentiating with respect to the affine parameter l and using
 * d/dr of the effective potential V(r) = L^2 (1/r^2 - rs/r^3) gives
 *
 *     d^2r/dl^2 = -V'(r)/2 = (L^2 / r^4) (r - 1.5 rs).
 *
 * Note the numerator (r - 1.5 rs): it vanishes at r = 1.5 rs, the photon
 * sphere. That is the effective-potential maximum -- above it a photon can
 * still turn around, below it nothing comes back. It is also a free check on
 * the algebra, because the photon sphere radius is textbook.
 *
 * The RHS is a polynomial in r with no 1/f singularity, so this form is safe
 * all the way down to the horizon. (The E/f form used by `geodesic.ts` diverges
 * as f -> 0 and has to be guarded; this one does not.)
 *
 * Azimuth follows from angular momentum, which is exactly conserved:
 *
 *     dphi/dl = L / r^2.
 */

export type Vec3 = readonly [number, number, number];

/**
 * Critical impact parameter b_c = 3*sqrt(3)/2 * rs = sqrt(27)/2 * rs.
 *
 * Photons with b < b_c are captured no matter where they came from, which is
 * exactly the angular radius of the dark disc an outside observer sees (the
 * "shadow"). Keeping it here lets both the tests and the renderer agree on one
 * number instead of restating the formula.
 */
export const CRITICAL_B = ((3 * Math.sqrt(3)) / 2) * RS;

/** Beyond this radius a photon is on its way out for good. */
export const ESCAPE_R_3D = 500;

/** Step budget before we stop marching. Rays that exhaust it are near-critical. */
export const MAX_STEPS_3D = 600;

/**
 * Capture radius. Checked slightly outside rs so we never integrate past the
 * horizon, even though the energy-reduced RHS stays finite there.
 */
export const CAPTURE_R = RS * 1.0001;

/**
 * Accretion disk radii, in units of rs.
 *
 * The disk is an infinitely thin annulus in the y = 0 plane -- there is no
 * vertical extent to intersect, only a plane crossing to detect. These match
 * uploadDiskUBO() in the reference (r1 = 2.2 r_s, r2 = 5.2 r_s).
 */
export const DISK_R1 = 2.2;
export const DISK_R2 = 5.2;

/**
 * Affine step bounds, in units of rs.
 *
 * The step scales with r because the interesting structure of the field lives
 * near the hole: a photon far away travels almost in a straight line, so a
 * large step costs nothing, while a photon skimming the photon sphere needs
 * small steps to resolve its winding. The clamps stop a large r from blowing
 * the step up and a small r from stalling the march.
 */
const STEP_FRACTION = 0.1;
const STEP_MIN = 0.02;
const STEP_MAX = 12;

/** One photon described in its own orbital plane. */
export interface PlaneRay {
  /** Unit vector from the origin to the launch point; also phi = 0's axis. */
  e1: Vec3;
  /** Unit in-plane vector along the initial transverse motion; phi = pi/2. */
  e2: Vec3;
  /** Areal radial coordinate r, in units of rs. */
  r: number;
  /** Azimuth in the (e1, e2) plane, radians. */
  phi: number;
  /** dr/d(lambda), the radial part of the 4-momentum. */
  dr: number;
  /** Conserved angular momentum L = r^2 dphi/d(lambda). With E = 1 this IS the impact parameter. */
  L: number;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Any unit vector perpendicular to `n`. Only used for a purely radial photon,
 * where the transverse direction (and therefore the plane) is undefined; L = 0
 * makes the choice irrelevant, we just need a valid basis to reconstruct with.
 */
function perpendicularTo(n: Vec3): Vec3 {
  // Cross with whichever coordinate axis is least aligned, to avoid a
  // near-parallel cross product collapsing to zero.
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  const axis: Vec3 = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1];
  const c: Vec3 = [n[1] * axis[2] - n[2] * axis[1], n[2] * axis[0] - n[0] * axis[2], n[0] * axis[1] - n[1] * axis[0]];
  const len = Math.hypot(c[0], c[1], c[2]);
  return [c[0] / len, c[1] / len, c[2] / len];
}

/**
 * Builds the orbital plane and the initial state from a launch point and a
 * unit direction.
 *
 * The null condition fixes the split between radial and transverse momentum.
 * With E normalised to 1, requiring the coordinate direction to come out
 * exactly as `dir` gives a single scale factor
 *
 *     sigma = 1 / sqrt( d_r^2 + f * d_t^2 )
 *
 * from which dr/d(lambda) = sigma * d_r and L = sigma * r * d_t. Sanity checks
 * that fall out of this: a photon aimed straight at the centre gets L = 0, and
 * a transverse photon at large r (f -> 1) gets L -> r * d_t = b, the impact
 * parameter, as it must.
 */
export function initPlaneRay(origin: Vec3, dir: Vec3): PlaneRay {
  const r = Math.hypot(origin[0], origin[1], origin[2]);
  if (!(r > 0)) throw new Error('initPlaneRay: origin is at the singularity');

  const invR = 1 / r;
  const e1: Vec3 = [origin[0] * invR, origin[1] * invR, origin[2] * invR];

  // Normalise defensively: callers sometimes pass a direction straight out of
  // a matrix multiply, where float drift can leave |dir| a few ulps off one.
  const dLen = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(dLen > 0)) throw new Error('initPlaneRay: direction has zero length');
  const u: Vec3 = [dir[0] / dLen, dir[1] / dLen, dir[2] / dLen];

  const dR = dot(u, e1);
  const t: Vec3 = [u[0] - dR * e1[0], u[1] - dR * e1[1], u[2] - dR * e1[2]];
  const dT = Math.hypot(t[0], t[1], t[2]);

  const e2: Vec3 = dT > 1e-9 ? [t[0] / dT, t[1] / dT, t[2] / dT] : perpendicularTo(e1);

  const f = 1 - RS / r;
  const sigma = 1 / Math.sqrt(dR * dR + f * dT * dT);

  return {
    e1,
    e2,
    r,
    phi: 0,
    dr: sigma * dR,
    L: sigma * r * dT,
  };
}

/**
 * Right-hand side of the energy-reduced system, in the order
 * [r, phi, dr]. See the module header for the derivation.
 */
function rhsOf(r: number, dr: number, L: number, out: number[]): void {
  const r2 = r * r;
  const r4 = r2 * r2;
  out[0] = dr; // dr/dl
  out[1] = L / r2; // dphi/dl, from the exact integral L = r^2 dphi/dl
  out[2] = ((L * L) / r4) * (r - 1.5 * RS); // d^2r/dl^2 = -V'(r)/2
}

/**
 * One 4th-order Runge-Kutta step. Returns false when the state went non-finite
 * (only possible if r collapsed onto the origin), which we report as capture
 * rather than letting NaN poison the rest of the march.
 */
export function stepPlaneRay(ray: PlaneRay, h: number): boolean {
  const { r, phi, dr, L } = ray;
  const k1: number[] = [0, 0, 0];
  const k2: number[] = [0, 0, 0];
  const k3: number[] = [0, 0, 0];
  const k4: number[] = [0, 0, 0];

  rhsOf(r, dr, L, k1);
  rhsOf(r + (h / 2) * k1[0], dr + (h / 2) * k1[2], L, k2);
  rhsOf(r + (h / 2) * k2[0], dr + (h / 2) * k2[2], L, k3);
  rhsOf(r + h * k3[0], dr + h * k3[2], L, k4);

  const nr = r + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  const nphi = phi + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  const ndr = dr + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);

  if (!Number.isFinite(nr) || !Number.isFinite(nphi) || !Number.isFinite(ndr)) return false;

  ray.r = nr;
  ray.phi = nphi;
  ray.dr = ndr;
  return true;
}

/** Rotates the in-plane state back into 3D: the photon's current position. */
export function planePosition(ray: PlaneRay): Vec3 {
  const c = Math.cos(ray.phi);
  const s = Math.sin(ray.phi);
  return [
    ray.r * (c * ray.e1[0] + s * ray.e2[0]),
    ray.r * (c * ray.e1[1] + s * ray.e2[1]),
    ray.r * (c * ray.e1[2] + s * ray.e2[2]),
  ];
}

/**
 * Cylindrical radius at which the segment `prev -> next` crosses the disk, or
 * -1 when it does not hit the annulus.
 *
 * This is the CPU twin of the plane-crossing test inside geodesic3d.wgsl. The
 * march loop rebuilds the cartesian position every step, and this decides
 * whether the segment passed through the disk: a sign change in y brackets the
 * crossing, linear interpolation locates it independently of the adaptive step
 * length, and the annulus test rejects the crossing when it lands outside
 * [DISK_R1, DISK_R2].
 *
 * It lives here rather than being inlined only in the shader because vitest
 * cannot execute WGSL -- the sign test and the interpolation are exactly the
 * sort of thing that silently inverts, and the tests below are the evidence
 * that both copies do the same thing.
 *
 * Returns the 3D radius of the crossing point (equal to the cylindrical radius
 * up to floating-point noise, since the point lies in the plane) so the caller
 * can shade it.
 */
export function diskCrossing(prev: Vec3, next: Vec3): number {
  // Strict inequality: touching the plane without passing through it (one
  // endpoint exactly on it) is not a crossing, and matches `prev.y * next.y < 0`.
  if (prev[1] * next[1] >= 0) return -1;

  const t = prev[1] / (prev[1] - next[1]);
  const hit: Vec3 = [
    prev[0] + t * (next[0] - prev[0]),
    prev[1] + t * (next[1] - prev[1]),
    prev[2] + t * (next[2] - prev[2]),
  ];

  const rho = Math.hypot(hit[0], hit[2]);
  if (rho < DISK_R1 || rho > DISK_R2) return -1;
  return Math.hypot(hit[0], hit[1], hit[2]);
}

/**
 * Entry point of the segment `prev -> next` into the sphere, or null when the
 * segment misses it entirely.
 *
 * CPU twin of segmentSphereHit() in geodesic3d.wgsl (WGSL has no nullable
 * type, so the shader returns vec4 and carries a hit flag in .w; the maths is
 * identical).
 *
 * WHY A SEGMENT AND NOT AN ENDPOINT
 * ---------------------------------
 * The reference tests `distance(P, center) <= radius` at the ENDPOINT of every
 * step and gets away with it because it marches with a fixed D_LAMBDA of 1e7 m
 * = 7.9e-4 rs. We cannot: our step is adaptive, h = clamp(0.1 r, 0.02, 12),
 * and the stars sit at 4e11 m = exactly ten times their own radius, so at
 * their distance the step comes out to
 *
 *     h = 0.1 * STAR_ORBIT = STAR_RADIUS
 *
 * -- one step equals one star radius. An endpoint test then loses every chord
 * shorter than a step, which is the outer band of the projected disc
 * (chord < h  <=>  impact parameter > sqrt(3)/2 * radius), about a quarter of
 * the area. The rim would erode and flicker as the phase of the samples
 * changed with the camera. Testing the whole segment is exact for a straight
 * chord, independent of step length, and there is a regression test below
 * pinning that case.
 *
 * Solving |prev + t d - center|^2 = radius^2 for t in [0, 1] is the usual
 * quadratic. When `prev` is already inside, c <= 0 and every t would be
 * negative, so that case is returned directly as a hit at `prev`.
 */
export function segmentSphereHit(prev: Vec3, next: Vec3, center: Vec3, radius: number): Vec3 | null {
  const dx = next[0] - prev[0];
  const dy = next[1] - prev[1];
  const dz = next[2] - prev[2];
  const mx = prev[0] - center[0];
  const my = prev[1] - center[1];
  const mz = prev[2] - center[2];

  const a = dx * dx + dy * dy + dz * dz;
  const b = 2 * (mx * dx + my * dy + mz * dz);
  const c = mx * mx + my * my + mz * mz - radius * radius;

  if (c <= 0) return prev;
  if (a <= 0) return null;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;

  // With c > 0 and a > 0 the two roots share a sign (product = c/a), so the
  // smaller one is the entry point whenever the sphere is ahead at all.
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0 || t > 1) return null;

  return [prev[0] + t * dx, prev[1] + t * dy, prev[2] + t * dz];
}

/**
 * Unit vector along the photon's VELOCITY, i.e. the direction the light ray is
 * actually travelling in coordinate space.
 *
 * This is deliberately NOT the position direction. The two differ by
 * atan(L / r), which is ~b/r radians: at the escape radius that is a couple of
 * degrees for a grazing ray, and using r-hat to sample the sky would smear the
 * background by exactly that much, worst for the rays that are supposed to
 * look straight. The asymptotic source direction is the velocity direction.
 *
 * In polar coordinates the velocity is (dr/dl) r-hat + r (dphi/dl) phi-hat,
 * and r dphi/dl = L/r, so the two components are dr and L/r.
 */
export function velocityDirection(ray: PlaneRay): Vec3 {
  const c = Math.cos(ray.phi);
  const s = Math.sin(ray.phi);
  const rHat: Vec3 = [c * ray.e1[0] + s * ray.e2[0], c * ray.e1[1] + s * ray.e2[1], c * ray.e1[2] + s * ray.e2[2]];
  const phiHat: Vec3 = [-s * ray.e1[0] + c * ray.e2[0], -s * ray.e1[1] + c * ray.e2[1], -s * ray.e1[2] + c * ray.e2[2]];

  const vr = ray.dr;
  const vt = ray.L / ray.r;
  const len = Math.hypot(vr, vt);
  if (!(len > 0)) return rHat;

  const a = vr / len;
  const b = vt / len;
  return [a * rHat[0] + b * phiHat[0], a * rHat[1] + b * phiHat[1], a * rHat[2] + b * phiHat[2]];
}

export interface MarchResult {
  /** True when the photon fell through the horizon. */
  captured: boolean;
  /** Velocity direction (unit): the way the light ray is heading right now. */
  dir: Vec3;
  /** How many RK4 steps the march used. */
  steps: number;
  /**
   * True when the step budget ran out before a physical stop.
   *
   * Only near-critical photons wind around the photon sphere long enough to
   * hit this. We still report them as escaping: they are inside a sub-pixel
   * shell of b_c, and declaring them captured would paint the shadow larger
   * than b_c allows.
   */
  exhausted: boolean;
}

/**
 * Affine step size for a given radius. Exported because the tests drive the
 * march loop by hand (to sample conserved quantities at every step) and must
 * use the same step the production march uses, or they would be testing a
 * different integrator.
 */
export function stepSizeFor(r: number): number {
  return Math.min(STEP_MAX, Math.max(STEP_MIN, STEP_FRACTION * r));
}

/** Marches one photon until it is captured, escapes, or runs out of steps. */
export function marchPlaneRay(ray: PlaneRay, maxSteps: number = MAX_STEPS_3D): MarchResult {
  for (let i = 0; i < maxSteps; i++) {
    if (ray.r <= CAPTURE_R) {
      return { captured: true, dir: velocityDirection(ray), steps: i, exhausted: false };
    }
    if (ray.r >= ESCAPE_R_3D) {
      return { captured: false, dir: velocityDirection(ray), steps: i, exhausted: false };
    }
    if (!stepPlaneRay(ray, stepSizeFor(ray.r))) {
      return { captured: true, dir: velocityDirection(ray), steps: i, exhausted: false };
    }
  }
  return { captured: false, dir: velocityDirection(ray), steps: maxSteps, exhausted: true };
}

/** Convenience: build the plane and march it in one call. */
export function traceRay3D(origin: Vec3, dir: Vec3): MarchResult {
  return marchPlaneRay(initPlaneRay(origin, dir));
}
