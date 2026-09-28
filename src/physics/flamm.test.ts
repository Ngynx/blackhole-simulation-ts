import { describe, expect, it } from 'vitest';
import { GRID_OFFSET, GRID_SIZE, GRID_SPACING, buildFlammMesh, flammHeight } from './flamm';

const VERTS = GRID_SIZE + 1;

describe('flammHeight', () => {
  it('matches 2*sqrt(rho - 1) + offset outside the horizon', () => {
    for (const rho of [1.5, 2, 5.2, 9.85, 40]) {
      expect(flammHeight(rho)).toBeCloseTo(2 * Math.sqrt(rho - 1) + GRID_OFFSET, 10);
    }
  });

  it('pins the height at 2*rs inside the horizon, as the reference does', () => {
    // black_hole.cpp evaluates sqrt(r_s * r_s) rather than the paraboloid
    // when dist <= r_s. Kept verbatim for fidelity with the original.
    expect(flammHeight(1)).toBeCloseTo(2 + GRID_OFFSET, 12);
    expect(flammHeight(0)).toBeCloseTo(2 + GRID_OFFSET, 12);
  });

  it('clamps with a discontinuity at rho = 1, exactly like the reference', () => {
    // Just outside the horizon z -> 0, so the surface sits at the raw offset;
    // at and inside it jumps to the clamped value. This is the reference's
    // behaviour, not ours, and it only affects the four innermost lattice
    // vertices, which end up underneath the shadow.
    //
    // `1 + Number.EPSILON` is the closest f64 above 1, so it is as close to the
    // right-hand limit as double precision allows -- sqrt of anything larger
    // is still far from zero by comparison.
    expect(flammHeight(1)).toBeCloseTo(2 + GRID_OFFSET, 12);
    expect(flammHeight(1 + Number.EPSILON)).toBeCloseTo(GRID_OFFSET, 6);
    expect(flammHeight(1) - flammHeight(1 + Number.EPSILON)).toBeCloseTo(2, 6);
  });

  it('rises monotonically away from the hole', () => {
    let previous = flammHeight(2);
    for (let rho = 2.25; rho <= 12; rho += 0.25) {
      const h = flammHeight(rho);
      expect(h).toBeGreaterThan(previous);
      previous = h;
    }
  });

  it('converts the reference constants from metres to rs', () => {
    expect(GRID_SPACING).toBeCloseTo(1e10 / 1.269e10, 10);
    expect(GRID_OFFSET).toBeCloseTo(-3e10 / 1.269e10, 10);
  });
});

describe('buildFlammMesh', () => {
  const mesh = buildFlammMesh();

  it('produces one vertex per lattice point', () => {
    expect(mesh.positions.length).toBe(VERTS * VERTS * 3);
  });

  it('links every cell with a rightward and a downward segment', () => {
    // GRID_SIZE * VERTS segments of each orientation, two indices each.
    expect(mesh.indices.length).toBe(GRID_SIZE * VERTS * 2 * 2);
    expect(Math.max(...mesh.indices)).toBe(VERTS * VERTS - 1);
  });

  it('stays inside the reference lattice footprint', () => {
    // `positions` is a Float32Array, so the stored coordinate is the f64 value
    // rounded to f32. Compare against the same rounding rather than the exact
    // f64 extent, or the test fails by one ulp on every outer vertex.
    const extent = Math.fround((GRID_SIZE / 2) * GRID_SPACING);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      expect(Math.abs(mesh.positions[i])).toBeLessThanOrEqual(extent);
      expect(Math.abs(mesh.positions[i + 2])).toBeLessThanOrEqual(extent);
    }
    expect(extent).toBeCloseTo(9.85, 2);
  });

  it('lifts every vertex onto the paraboloid', () => {
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const [x, y, z] = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
      expect(y).toBeCloseTo(flammHeight(Math.hypot(x, z)), 5);
    }
  });

  it('dips closest to the hole and rises at the rim', () => {
    // GRID_SIZE is odd, so no vertex lands exactly on the axis: the four
    // innermost ones are as close as the lattice gets, and at 0.56 rs they are
    // still inside the horizon radius -- which is why they take the clamped
    // height rather than the paraboloid's.
    const mid = Math.floor(GRID_SIZE / 2);
    const inner = (mid * VERTS + mid) * 3;
    const corner = (GRID_SIZE * VERTS + GRID_SIZE) * 3;

    expect(mesh.positions[inner + 1]).toBeCloseTo(flammHeight(0), 6);
    expect(mesh.positions[inner + 1]).toBeLessThan(mesh.positions[corner + 1]);
    expect(mesh.positions[corner + 1]).toBeCloseTo(
      flammHeight(Math.hypot(mesh.positions[corner], mesh.positions[corner + 2])),
      5,
    );
  });
});
