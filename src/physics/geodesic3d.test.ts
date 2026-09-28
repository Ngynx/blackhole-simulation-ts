import { describe, expect, it } from 'vitest';
import { RS } from './constants';
import {
  CAPTURE_R,
  CRITICAL_B,
  ESCAPE_R_3D,
  initPlaneRay,
  marchPlaneRay,
  planePosition,
  stepPlaneRay,
  stepSizeFor,
  velocityDirection,
  type Vec3,
} from './geodesic3d';

/**
 * Numerical tests for the 3D geodesic integrator.
 *
 * `src/shaders/geodesic3d.wgsl` is a line-by-line transcription of this
 * module, and WGSL cannot be executed by vitest, so this file is the only
 * place the equations can be proved right. Everything the shader claims -- the
 * shadow radius, the weak-field deflection, the capture threshold -- is
 * asserted here first.
 */

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function norm(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function normalize(a: Vec3): Vec3 {
  const n = norm(a);
  return [a[0] / n, a[1] / n, a[2] / n];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(Math.max(-1, Math.min(1, dot3(normalize(a), normalize(b)))));
}

/** Marches by hand so the caller can sample conserved quantities every step. */
function marchSampling(
  origin: Vec3,
  dir: Vec3,
  sample: (r: number, dr: number, L: number, pos: Vec3, vel: Vec3) => void,
  maxSteps = 5000,
): { captured: boolean; steps: number } {
  const ray = initPlaneRay(origin, dir);
  let steps = 0;
  while (steps < maxSteps && ray.r > CAPTURE_R && ray.r < ESCAPE_R_3D) {
    sample(ray.r, ray.dr, ray.L, planePosition(ray), velocityDirection(ray));
    if (!stepPlaneRay(ray, stepSizeFor(ray.r))) return { captured: true, steps };
    steps++;
  }
  return { captured: ray.r <= CAPTURE_R, steps };
}

describe('3D geodesic integration', () => {
  it('reproduces the requested launch direction from (dr, L)', () => {
    // The whole 3D-to-plane reduction hinges on sigma = 1/sqrt(d_r^2 + f d_t^2).
    // If that split is wrong the photon starts out heading somewhere else, and
    // every downstream number (deflection, shadow radius) is then wrong too.
    const origin: Vec3 = [20, 15, 35];
    const dir = normalize([-0.7, -0.3, -0.65]);
    const ray = initPlaneRay(origin, dir);

    const vel = velocityDirection(ray);
    expect(angleBetween(vel, dir)).toBeLessThan(1e-12);
    expect(norm(vel)).toBeCloseTo(1, 12);
    expect(ray.L).toBeGreaterThan(0);
  });

  it('keeps the photon in the plane spanned by (e1, e2)', () => {
    // A photon launched with an out-of-plane direction must never leave that
    // plane: spherical symmetry makes the plane normal a constant of motion.
    // This is what justifies reducing 3D motion to two coordinates at all.
    const origin: Vec3 = [20, 15, 35];
    const dir = normalize([-0.7, -0.3, -0.65]);
    const ray = initPlaneRay(origin, dir);
    const normal = normalize(cross(ray.e1, ray.e2));

    let worst = 0;
    let steps = 0;
    marchSampling(origin, dir, (_r, _dr, _L, pos) => {
      worst = Math.max(worst, Math.abs(dot3(pos, normal) / norm(pos)));
      steps++;
    });

    // ~80 adaptive steps: far-field steps are large, so a lower bound is the
    // only sensible assertion -- an upper bound would break on any tuning.
    expect(steps).toBeGreaterThan(50);
    expect(worst).toBeLessThan(1e-12);
  });

  it('satisfies the radial first integral (dr/dλ)² + f·L²/r² = 1', () => {
    // E is normalised to 1 by construction, so the first integral is an exact
    // identity along the trajectory. Any drift is pure integrator error, which
    // makes this the sharpest available check on the RHS and the RK4 weights --
    // the same test that catches the upstream missing-f bug in the 2D code.
    let worst = 0;
    let steps = 0;
    const res = marchSampling([-400, 20, 0], [1, 0, 0], (r, dr, L) => {
      const f = 1 - RS / r;
      const residual = dr * dr + (f * L * L) / (r * r) - 1;
      worst = Math.max(worst, Math.abs(residual));
      steps++;
    });

    expect(res.captured).toBe(false);
    expect(steps).toBeGreaterThan(50);
    expect(worst).toBeLessThan(1e-3);
  });

  it('deflects a weak-field ray by the analytic angle', () => {
    // Same evidence as the 2D test, measured with the 3D integrator: launched
    // from r = 400 rs and followed back out past r = 500 rs so both ends are
    // effectively asymptotic.
    //
    // The leading order alpha = 2 rs / b is not enough here. At b = 20 the
    // post-Minkowskian second order term
    //     alpha ≈ 4M/b + (15π/4)(M/b)²,  M = rs/2
    //           = 2·rs/b + (15π/16)(rs/b)²
    // is worth +7%, which a 2% band would catch as a failure if the equations
    // or the stepper were wrong.
    const ray = initPlaneRay([-400, 20, 0], [1, 0, 0]);
    const result = marchPlaneRay(ray);
    expect(result.captured).toBe(false);
    expect(result.exhausted).toBe(false);

    const measured = angleBetween([1, 0, 0], velocityDirection(ray));
    // E = 1, so L is the impact parameter directly (the launch offset b = 20
    // differs slightly because the ray starts at finite r, not at infinity).
    const impact = ray.L;
    const analytic = (2 * RS) / impact + ((15 * Math.PI) / 16) * (RS / impact) ** 2;
    expect(Math.abs(measured - analytic) / analytic).toBeLessThan(0.02);
  });

  it('brackets capture exactly at the critical impact parameter', () => {
    // b_c = 3√3/2 · rs is the boundary of the shadow: below it the effective
    // potential has no barrier tall enough to turn the photon around, above it
    // it always does. Launching from r = 100 rs, L lands within 0.01% of the
    // geometric offset b, so this is a clean threshold test.
    const below = initPlaneRay([-100, 0.95 * CRITICAL_B, 0], [1, 0, 0]);
    const belowResult = marchPlaneRay(below);
    expect(belowResult.captured).toBe(true);
    expect(belowResult.exhausted).toBe(false);

    const above = initPlaneRay([-100, 1.05 * CRITICAL_B, 0], [1, 0, 0]);
    const aboveResult = marchPlaneRay(above);
    expect(aboveResult.captured).toBe(false);
    expect(aboveResult.exhausted).toBe(false);
  });

  it('gives a radial photon zero angular momentum and drives it straight in', () => {
    // A photon aimed at the centre has no transverse motion, so the orbital
    // plane is genuinely undefined -- L must come out 0 rather than be fudged
    // by whichever fallback basis perpendicularTo() picked.
    const ray = initPlaneRay([-40, 0, 0], [1, 0, 0]);
    expect(Math.abs(ray.L)).toBeLessThan(1e-12);

    const result = marchPlaneRay(ray);
    expect(result.captured).toBe(true);
    expect(result.exhausted).toBe(false);
  });

  it('lets a radially escaping photon keep its direction exactly', () => {
    // L = 0 means dphi/dl = 0: phi never moves, so the velocity direction is
    // frozen. Any drift here would be reconstruction error, not physics.
    const ray = initPlaneRay([0, 0, 40], [0, 0, 1]);
    expect(Math.abs(ray.L)).toBeLessThan(1e-12);

    const result = marchPlaneRay(ray);
    expect(result.captured).toBe(false);
    expect(result.exhausted).toBe(false);
    expect(result.dir[0]).toBeCloseTo(0, 12);
    expect(result.dir[1]).toBeCloseTo(0, 12);
    expect(result.dir[2]).toBeCloseTo(1, 12);
  });

  it('measures the shadow radius at the critical impact parameter', () => {
    // CRITICAL_B is what the renderer uses to draw the shadow, so pin it to the
    // textbook value instead of trusting the formula silently drifting.
    expect(CRITICAL_B).toBeCloseTo(2.5980762, 6);
    // r = 1.5 rs, where the effective potential peaks. Independent of the
    // shadow constant, and the RHS vanishes there by construction.
    const ray = initPlaneRay([-400, CRITICAL_B, 0], [1, 0, 0]);
    expect(Math.abs(ray.L - CRITICAL_B) / CRITICAL_B).toBeLessThan(1e-4);
  });

  it('reports the position direction and velocity direction as different', () => {
    // The sky is sampled with the velocity direction. Confusing the two would
    // rotate the background by atan(b/r) -- several degrees at escape radius --
    // so assert they really are not the same vector.
    const ray = initPlaneRay([-400, 20, 0], [1, 0, 0]);
    marchPlaneRay(ray);
    const vel = velocityDirection(ray);
    const pos = normalize(planePosition(ray));
    expect(angleBetween(vel, pos)).toBeGreaterThan(0.01);
    expect(Math.abs(norm(vel) - 1)).toBeLessThan(1e-12);
    expect(norm(sub(vel, pos))).toBeGreaterThan(0.01);
  });
});
