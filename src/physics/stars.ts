import type { Vec3 } from './geodesic3d';

/**
 * The two static stars of the reference render.
 *
 * black_hole.cpp pushes three ObjectData rows into the objects UBO: the black
 * hole itself (which `intercept()` catches first, so the shader never reaches
 * that row) and two stars. Their geometry is written in metres because the
 * reference integrates in SI; it is converted into rs exactly once, here, for
 * the same reason flamm.ts does it -- f32 cannot hold SI numbers at the
 * precision the integrator needs (see src/physics/constants.ts).
 *
 * Both stars lie in the equatorial plane, the same plane the accretion disk
 * occupies, and that is what makes them the interesting lensing subject: orbit
 * until one sits behind the hole and its image is stretched into an arc that
 * hugs the shadow.
 *
 * They are STATIC. The reference does carry N-body masses and velocities, but
 * `bool Gravity = false` (black_hole.cpp:29) leaves them switched off by
 * default, so a straight port has nothing moving and no mass term to model.
 */

/** Sagittarius A* Schwarzschild radius in metres, as used by the reference. */
const RS_SI = 1.269e10;

/** Star radius: 4e10 m in the reference, expressed in rs. */
export const STAR_RADIUS = 4e10 / RS_SI;

/** Orbital radius of both stars: 4e11 m, expressed in rs (exactly 10 x STAR_RADIUS). */
export const STAR_ORBIT = 4e11 / RS_SI;

export interface Star {
  /** Centre in rs. */
  readonly pos: Vec3;
  /** Radius in rs. */
  readonly radius: number;
  /** Base colour, 0..1 per channel. */
  readonly color: readonly [number, number, number];
}

/**
 * Yellow at +x, red at +z -- the reference's order, and the order the shader
 * iterates in. `STAR_COUNT` in geodesic3d.wgsl must equal `STARS.length`;
 * there is a parity test for exactly that.
 */
export const STARS: readonly Star[] = [
  { pos: [STAR_ORBIT, 0, 0], radius: STAR_RADIUS, color: [1, 1, 0] },
  { pos: [0, 0, STAR_ORBIT], radius: STAR_RADIUS, color: [1, 0, 0] },
];

/** Floats per star in the uniform: posRadius (4) + colour (4). */
export const STAR_FLOATS = 8;

/**
 * Packs the stars into the objects uniform the compute shader reads.
 *
 * Layout mirrors the WGSL `Star` struct: xyz centre + w radius, then rgb
 * colour + w = 1 (the reference stores an opaque alpha and the shading path
 * passes it through; nothing in this port reads it, but keeping the stride
 * identical to the struct means the buffer cannot drift out of sync).
 */
export function packStars(): Float32Array {
  const out = new Float32Array(STARS.length * STAR_FLOATS);
  STARS.forEach((star, i) => {
    const o = i * STAR_FLOATS;
    out[o] = star.pos[0];
    out[o + 1] = star.pos[1];
    out[o + 2] = star.pos[2];
    out[o + 3] = star.radius;
    out[o + 4] = star.color[0];
    out[o + 5] = star.color[1];
    out[o + 6] = star.color[2];
    out[o + 7] = 1;
  });
  return out;
}
