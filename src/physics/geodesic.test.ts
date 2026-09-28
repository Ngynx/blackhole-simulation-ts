import { describe, expect, it } from 'vitest';
import { D_LAMBDA, RS } from './constants';
import { cartesian, initRay2D, rk4Step, stepRay, traceRay, type Ray2D } from './geodesic';

/**
 * Numerical tests for the Schwarzschild null-geodesic integrator.
 *
 * These are the correctness evidence for the port: they prove the right-hand
 * side of the geodesic equation and the RK4 stepper reproduce the analytic
 * structure of the problem (conserved quantities + weak-field deflection),
 * rather than merely producing plausible-looking curves.
 */

function directionAt(samples: number[], i: number): { x: number; y: number } {
  const ax = samples[2 * (i - 1)];
  const ay = samples[2 * (i - 1) + 1];
  const bx = samples[2 * i];
  const by = samples[2 * i + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  return { x: dx / len, y: dy / len };
}

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
  return Math.acos(dot);
}

/** Traces a ray with an explicit stop predicate (independent of ESCAPE_R). */
function traceUntil(
  pos: { x: number; y: number },
  dir: { x: number; y: number },
  shouldStop: (ray: Ray2D, step: number) => boolean,
  maxSteps = 30000,
): { samples: number[]; ray: Ray2D } {
  const ray = initRay2D(pos, dir);
  const first = cartesian(ray);
  const samples: number[] = [first.x, first.y];

  for (let i = 0; i < maxSteps; i++) {
    if (!rk4Step(ray, D_LAMBDA)) break;
    const p = cartesian(ray);
    samples.push(p.x, p.y);
    if (shouldStop(ray, i)) break;
  }
  return { samples, ray };
}

describe('geodesic integration', () => {
  it('conserves angular momentum L = r² dφ/dλ along the trajectory', () => {
    // L is an exact first integral: φ'' = -2 r' φ'/r implies d(r²φ')/dλ = 0.
    // So any drift here is pure integrator error -- the sharpest available
    // check that the RHS and the RK4 weights are right.
    const b = 6;
    const { samples, ray } = traceUntil({ x: -40, y: b }, { x: 1, y: 0 }, () => false);
    const L0 = -b; // dφ = -b/r² at launch, so L = r² dφ = -b
    expect(samples.length).toBeGreaterThan(100);
    expect(Math.abs(ray.L - L0) / Math.abs(L0)).toBeLessThan(1e-3);
  });

  it('satisfies the radial first integral (dr/dλ)² = E² − f·L²/r² at every step', () => {
    // This is the test that catches the upstream bug: the d²r/dλ² term must
    // carry the metric factor f (Gamma^r_phiphi = -r·f). Dropping it breaks
    // this identity exactly where f → 0, i.e. near the horizon.
    const b = 6;
    const ray = initRay2D({ x: -40, y: b }, { x: 1, y: 0 });
    const { E, L } = ray;

    let worst = 0;
    let steps = 0;
    while (stepRay(ray) === 'ok' && steps < 20000) {
      const f = 1 - RS / ray.r;
      const residual = ray.dr * ray.dr + (f * L * L) / (ray.r * ray.r) - E * E;
      worst = Math.max(worst, Math.abs(residual) / (E * E));
      steps++;
    }
    expect(steps).toBeGreaterThan(500);
    expect(worst).toBeLessThan(1e-3);
  });

  it('deflects a weak-field ray by the analytic angle', () => {
    // Launched from r = 400 rs and followed until r > 400 rs on the way out,
    // so both endpoints are effectively asymptotic (verified: repeating at
    // 800 and 1600 rs changes the result only in the 6th decimal).
    //
    // The textbook leading order alpha = 4GM/(bc²) = 2·rs/b is not accurate
    // enough here: at b = 20 rs the post-Minkowskian second-order term
    //     alpha ≈ 4M/b + (15π/4)(M/b)²,   M = rs/2
    //           = 2·rs/b + (15π/16)(rs/b)²
    // contributes +7%, and the third order adds another +0.7%. We compare
    // against that expansion with a 2% band, which would fail loudly if the
    // RHS or the RK4 weights were wrong.
    const b = 20;
    const { samples, ray } = traceUntil(
      { x: -400, y: b },
      { x: 1, y: 0 },
      (r) => r.r > 400 && r.dr > 0,
    );

    expect(samples.length).toBeGreaterThan(1000);
    const incoming = directionAt(samples, 1);
    const outgoing = directionAt(samples, samples.length / 2 - 1);
    const measured = angleBetween(incoming, outgoing);

    // Impact parameter at infinity is b = L/E (not the launch offset: E ≠ 1).
    const impact = Math.abs(ray.L) / ray.E;
    const analytic = (2 * RS) / impact + ((15 * Math.PI) / 16) * (RS / impact) ** 2;
    expect(Math.abs(measured - analytic) / analytic).toBeLessThan(0.02);
  });

  it('captures a ray whose impact parameter is below the photon-sphere limit', () => {
    // b < 3√3/2 · rs ≈ 2.598 rs: no outward turn exists, the ray falls in.
    const { outcome } = traceRay({ x: -40, y: 1 }, { x: 1, y: 0 });
    expect(outcome).toBe('captured');
  });

  it('lets a large-impact-parameter ray escape with negligible deflection', () => {
    const b = 50;
    const { samples, outcome } = traceRay({ x: -45, y: b }, { x: 1, y: 0 });
    expect(outcome).toBe('escaped');

    const measured = angleBetween(directionAt(samples, 1), directionAt(samples, samples.length / 2 - 1));
    const analytic = 2 * RS / b;
    expect(measured).toBeLessThan(0.05);
    expect(measured).toBeLessThan(analytic);
  });
});
