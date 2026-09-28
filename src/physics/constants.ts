/**
 * Physical constants, in normalized geometric units.
 *
 * The original C++ project works in SI: the Sagittarius A* Schwarzschild
 * radius comes out as rs = 2GM/c^2 = 1.269e10 m, and rays escape at r = 1e30.
 * IEEE-754 double has ~15 significant digits, but WGSL only has `f32`
 * (~7 significant digits), so keeping SI numbers would silently destroy the
 * derivative terms of the geodesic equation in the 3D compute shader.
 *
 * Instead every length is measured in units of the Schwarzschild radius and
 * every mass/energy combination is absorbed into rs. G and c never appear in
 * the equations below -- that is the whole point of geometric units.
 */

/** Schwarzschild radius, rs = 2GM/c^2. All distances are in units of rs. */
export const RS = 1;

/**
 * Affine-parameter step d(lambda).
 *
 * lambda is the affine parameter along the null geodesic (NOT coordinate
 * time). Far from the hole f -> 1 and dr/d(lambda) -> E -> 1, so lambda
 * behaves roughly like arc length measured in rs. MAX_STEPS * D_LAMBDA is
 * therefore the total travel budget of one ray.
 */
export const D_LAMBDA = 0.05;

/** Maximum RK4 steps per ray before we give up on it. */
export const MAX_STEPS = 6000;

/** Beyond this radius the ray is considered lost to interstellar space. */
export const ESCAPE_R = 200;

/** Capture threshold: r <= rs is inside the event horizon. */
export const HORIZON_EPS = 1;
