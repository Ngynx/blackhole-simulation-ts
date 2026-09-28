import { describe, expect, it } from 'vitest';
import { STAR_FLOATS, STAR_ORBIT, STAR_RADIUS, STARS, packStars } from './stars';

/**
 * The reference's object geometry, pinned to the numbers black_hole.cpp:144-149
 * actually uploads, and the packing the compute shader reads back.
 *
 * These values are the whole contract with geodesic3d.wgsl: the shader gets
 * its positions from the uniform, so if this module is wrong the shader is
 * wrong with no local symptom to point at.
 */
describe('stars', () => {
  it('converts the reference SI values into rs', () => {
    // ObjectData rows are 4e11 m centres with 4e10 m radii, and the reference
    // black hole has r_s = 2GM/c^2 = 1.269e10 m (Sagittarius A*).
    expect(STAR_RADIUS).toBeCloseTo(4e10 / 1.269e10, 10);
    expect(STAR_ORBIT).toBeCloseTo(4e11 / 1.269e10, 10);

    // The two numbers are not independent: 4e11 is ten times 4e10. That is
    // what makes the adaptive step at the star's distance come out to exactly
    // one star radius, which is why segmentSphereHit() tests a segment.
    expect(STAR_ORBIT / STAR_RADIUS).toBeCloseTo(10, 10);

    expect(STAR_RADIUS).toBeCloseTo(3.15209, 4);
    expect(STAR_ORBIT).toBeCloseTo(31.5209, 4);
  });

  it('keeps the reference colours, positions and order', () => {
    expect(STARS.map((s) => s.color)).toEqual([
      [1, 1, 0],
      [1, 0, 0],
    ]);
    expect(STARS.map((s) => s.pos)).toEqual([
      [STAR_ORBIT, 0, 0],
      [0, 0, STAR_ORBIT],
    ]);
    expect(STARS.every((s) => s.radius === STAR_RADIUS)).toBe(true);
    // Both stars sit in the equatorial plane. That is what lets an orbiting
    // camera line one up behind the hole and stretch it into an arc.
    expect(STARS.every((s) => s.pos[1] === 0)).toBe(true);
  });

  it('packs posRadius then colour, 8 floats per star', () => {
    const packed = packStars();
    expect(packed).toHaveLength(STARS.length * STAR_FLOATS);
    // Buffer the renderer allocates must match what this produces.
    expect(packed.byteLength).toBe(STARS.length * STAR_FLOATS * 4);

    // Float32Array rounds on store, so the packed value is Math.fround() of
    // the double constant -- not the double. Asserting that explicitly keeps
    // the tolerance honest instead of loosening it until it passes.
    expect(packed[0]).toBe(Math.fround(STAR_ORBIT));
    expect(packed[1]).toBe(0);
    expect(packed[2]).toBe(0);
    expect(packed[3]).toBe(Math.fround(STAR_RADIUS));
    expect(Array.from(packed.slice(4, 7))).toEqual([1, 1, 0]);
    expect(packed[7]).toBe(1); // opaque, as the reference stores it

    expect(packed[8]).toBe(0);
    expect(packed[9]).toBe(0);
    expect(packed[10]).toBe(Math.fround(STAR_ORBIT));
    expect(Array.from(packed.slice(12, 15))).toEqual([1, 0, 0]);
    expect(packed[15]).toBe(1);
  });
});
