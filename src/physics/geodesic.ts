import { D_LAMBDA, ESCAPE_R, HORIZON_EPS, MAX_STEPS, RS } from './constants';

/**
 * Null geodesics around a Schwarzschild black hole, integrated in 2D.
 *
 * Coordinates: the orbital plane (x, y) is re-expressed as polar (r, phi).
 * Working in polar coordinates is what makes the geodesic equation tractable:
 * the Schwarzschild metric in the equatorial plane is
 *
 *     ds^2 = -f dt^2 + dr^2/f + r^2 dphi^2,      f = 1 - rs/r
 *
 * and a photon travelling in a plane through the centre stays in that plane,
 * so theta is constant and only (r, phi) need to be integrated.
 *
 * We do NOT integrate coordinate time t. For null geodesics the t-evolution
 * is slaved to the spatial motion through the conserved energy E, which lets
 * us integrate 4 first-order equations instead of 5.
 */

/** One photon: polar position, polar velocity, and the two constants of motion. */
export interface Ray2D {
  /** Areal radial coordinate r, in units of rs. r = rs is the event horizon. */
  r: number;
  /** Azimuthal angle phi in the orbital plane, radians. */
  phi: number;
  /** dr/d(lambda): rate of change of r with respect to the affine parameter. */
  dr: number;
  /** dphi/d(lambda): angular rate w.r.t. the affine parameter. */
  dphi: number;
  /**
   * Conserved energy E = f * dt/d(lambda) (Killing energy of the photon).
   * Constant along the whole trajectory; that is why dt/d(lambda) = E/f can be
   * reconstructed on demand inside the RHS instead of being integrated.
   */
  E: number;
  /**
   * Conserved angular momentum L = r^2 * dphi/d(lambda).
   * For a photon arriving from infinity with impact parameter b, |L| = b * E,
   * so with E normalised near 1 this number IS the impact parameter.
   */
  L: number;
}

/**
 * Seeds a ray from a cartesian position and direction.
 *
 * The null condition 0 = -f dt^2 + dr^2/f + r^2 dphi^2 (ds^2 = 0 for light)
 * solved for dt/d(lambda) gives
 *
 *     dt/d(lambda) = sqrt( dr^2/f^2 + r^2 dphi^2 / f )
 *
 * and the conserved energy is E = f * dt/d(lambda).
 */
export function initRay2D(pos: { x: number; y: number }, dir: { x: number; y: number }): Ray2D {
  const r = Math.hypot(pos.x, pos.y);
  const phi = Math.atan2(pos.y, pos.x);

  // Rotate the cartesian direction into the local polar frame
  // (radial unit vector, tangential unit vector).
  const dr = dir.x * Math.cos(phi) + dir.y * Math.sin(phi);
  const dphi = (-dir.x * Math.sin(phi) + dir.y * Math.cos(phi)) / r;

  const f = 1 - RS / r;
  const dt_dλ = Math.sqrt((dr * dr) / (f * f) + (r * r * dphi * dphi) / f);

  return {
    r,
    phi,
    dr,
    dphi,
    E: f * dt_dλ,
    L: r * r * dphi,
  };
}

/**
 * Right-hand side of the geodesic equation: the Christoffel-symbol
 * acceleration terms d^2 x^mu / d(lambda)^2 = -Gamma^mu_ab (dx^a/dl)(dx^b/dl).
 *
 * Writes [dr/dl, dphi/dl, d^2r/dl^2, d^2phi/dl^2] into `out`.
 *
 * NOTE ON A BUG IN THE UPSTREAM PROJECT:
 * the radial acceleration's angular term must be `+ r * f * dphi^2`
 * (because Gamma^r_phiphi = -r * f, so -Gamma^r_phiphi * dphi^2 = + r f dphi^2).
 * The upstream repo's GLSL 3D shader wrote `r * dphi^2`, dropping the factor f.
 * That violates the first integral (dr/dl)^2 = E^2 - f L^2 / r^2 exactly where
 * f -> 0 near the horizon, and visibly distorts the photon ring. The upstream
 * 2D code wrote `(r - rs) * dphi^2`, which is the same as `r * f * dphi^2`
 * and is correct; we keep that form.
 */
export function geodesicRHS(ray: Ray2D, out: number[]): void {
  const { r, dr, dphi, E } = ray;

  // Schwarzschild metric function: f = 1 - rs/r. f -> 1 at infinity,
  // f -> 0 at the event horizon (the surface where all clocks freeze).
  const f = 1 - RS / r;

  // Energy conservation E = f * dt/d(lambda)  =>  dt/d(lambda) = E / f.
  // The photon speeds up in coordinate time as it climbs out of the gravity well.
  const dt_dλ = E / f;

  // d(r)/d(lambda)
  out[0] = dr;

  // d(phi)/d(lambda)
  out[1] = dphi;

  // d^2 r / d(lambda)^2 = -Gamma^r_tt (dt/dl)^2 - Gamma^r_rr (dr/dl)^2
  //                        - Gamma^r_phiphi (dphi/dl)^2
  out[2] =
    -(RS / (2 * r * r)) * f * (dt_dλ * dt_dλ) + // -Gamma^r_tt = -(f f')/2 with f' = rs/r^2
    (RS / (2 * r * r * f)) * (dr * dr) + // -Gamma^r_rr = +f'/(2f)
    r * f * (dphi * dphi); // -Gamma^r_phiphi = +r f  (see note above)

  // d^2 phi / d(lambda)^2 = -2 Gamma^phi_rphi (dr/dl)(dphi/dl),
  // with Gamma^phi_rphi = 1/r. This is pure Coriolis-like transport: as the
  // ray falls inward (dr < 0) its angular rate increases, conserving L.
  out[3] = (-2 * dr * dphi) / r;
}

/**
 * One 4th-order Runge-Kutta step of the state [r, phi, dr, dphi].
 *
 * Returns false WITHOUT touching the ray when the state sits on the horizon:
 * at f -> 0 the term RS/(2 r^2 f) diverges, so integrating across the horizon
 * is meaningless (and physically the photon has already been lost).
 */
export function rk4Step(ray: Ray2D, dλ: number): boolean {
  const f0 = 1 - RS / ray.r;
  if (f0 <= 1e-6) return false;

  const y0 = [ray.r, ray.phi, ray.dr, ray.dphi];
  const k1 = rhsOf(y0, ray.E);
  const k2 = rhsOf(addScaled(y0, k1, dλ / 2), ray.E);
  const k3 = rhsOf(addScaled(y0, k2, dλ / 2), ray.E);
  const k4 = rhsOf(addScaled(y0, k3, dλ), ray.E);

  const r = y0[0] + (dλ / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  const phi = y0[1] + (dλ / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  const dr = y0[2] + (dλ / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  const dphi = y0[3] + (dλ / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);

  // A stage that fell through the horizon can produce inf/NaN; treat that as
  // capture rather than poisoning the whole trail.
  if (!Number.isFinite(r) || !Number.isFinite(phi) || !Number.isFinite(dr) || !Number.isFinite(dphi)) {
    return false;
  }

  ray.r = r;
  ray.phi = phi;
  ray.dr = dr;
  ray.dphi = dphi;
  return true;
}

/** y0 + factor * k, the standard RK4 stage construction. */
function addScaled(y0: number[], k: number[], factor: number): number[] {
  return [
    y0[0] + k[0] * factor,
    y0[1] + k[1] * factor,
    y0[2] + k[2] * factor,
    y0[3] + k[3] * factor,
  ];
}

/** Evaluates the ODE system for a trial state; E is a constant of motion. */
function rhsOf(state: number[], E: number): number[] {
  const trial: Ray2D = { r: state[0], phi: state[1], dr: state[2], dphi: state[3], E, L: 0 };
  const out: number[] = [0, 0, 0, 0];
  geodesicRHS(trial, out);
  return out;
}

export type StepOutcome = 'ok' | 'captured' | 'escaped';

/**
 * Advances one ray by d(lambda) and reports why it stopped, if it stopped.
 *
 * The horizon test runs BEFORE the step so a ray that already sits inside
 * rs is never integrated (its RHS is singular).
 */
export function stepRay(ray: Ray2D, dλ: number = D_LAMBDA): StepOutcome {
  if (ray.r <= HORIZON_EPS) return 'captured';
  if (!rk4Step(ray, dλ)) return 'captured';
  if (ray.r >= ESCAPE_R) return 'escaped';
  return 'ok';
}

/** Polar state -> cartesian point on the trail, in units of rs. */
export function cartesian(ray: Ray2D): { x: number; y: number } {
  return { x: ray.r * Math.cos(ray.phi), y: ray.r * Math.sin(ray.phi) };
}

/** Runs a ray to completion, returning every recorded cartesian sample. */
export function traceRay(
  pos: { x: number; y: number },
  dir: { x: number; y: number },
): { samples: number[]; outcome: StepOutcome; ray: Ray2D } {
  const ray = initRay2D(pos, dir);
  const samples: number[] = [];
  const start = cartesian(ray);
  samples.push(start.x, start.y);

  let outcome: StepOutcome = 'ok';
  for (let i = 0; i < MAX_STEPS; i++) {
    outcome = stepRay(ray);
    if (outcome !== 'ok') break;
    const p = cartesian(ray);
    samples.push(p.x, p.y);
  }

  return { samples, outcome, ray };
}
