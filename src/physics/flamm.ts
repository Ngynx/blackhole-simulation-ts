/**
 * Wireframe for the spacetime-curvature overlay.
 *
 * The reference (black_hole.cpp, generateGrid()) lays a square lattice on the
 * equatorial plane and lifts every vertex onto Flamm's paraboloid -- the
 * surface of revolution that embeds Schwarzschild's spatial geometry in flat
 * 3-space:
 *
 *     z(rho) = 2 sqrt(r_s (rho - r_s)),   rho >= r_s
 *
 * which in units of rs is z = 2 sqrt(rho - 1). It is zero at the horizon (the
 * throat) and grows without bound outward, which is exactly the "trapdoor in
 * spacetime" the reference README describes.
 *
 * The reference works in metres: lattice pitch 1e10 m, vertical offset
 * -3e10 m, with r_s = 1.269e10 m for Sagittarius A*. Both constants are
 * converted to rs once, here, so nothing downstream carries SI numbers (f32
 * cannot hold them at the precision the integrator needs).
 */

/** Sagittarius A* Schwarzschild radius in metres, as used by the reference. */
const RS_SI = 1.269e10;

/** Lattice pitch: 1e10 m in the reference, expressed in rs (~0.788). */
export const GRID_SPACING = 1e10 / RS_SI;

/** Vertical centring offset: -3e10 m in the reference, expressed in rs. */
export const GRID_OFFSET = -3e10 / RS_SI;

/** The lattice is GRID_SIZE x GRID_SIZE cells, i.e. (GRID_SIZE + 1)^2 vertices. */
export const GRID_SIZE = 25;

/**
 * Height of the embedding surface, in rs, at cylindrical radius `rho` (also rs).
 *
 * Inside the horizon the reference does not evaluate the square root (it would
 * be imaginary); it pins the height at 2 r_s instead, so the throat keeps a
 * finite opening rather than collapsing.
 */
export function flammHeight(rho: number): number {
  if (rho > 1) return 2 * Math.sqrt(rho - 1) + GRID_OFFSET;
  return 2 + GRID_OFFSET;
}

export interface FlammMesh {
  /** xyz triples. Vertex index = z * (GRID_SIZE + 1) + x. */
  readonly positions: Float32Array;
  /** Line-list indices, two per segment. */
  readonly indices: Uint16Array;
}

/**
 * Builds the overlay mesh: every vertex warped onto the paraboloid, every
 * cell contributing a rightward and a downward segment.
 */
export function buildFlammMesh(): FlammMesh {
  const verts = GRID_SIZE + 1;
  const positions = new Float32Array(verts * verts * 3);
  let p = 0;
  for (let z = 0; z < verts; z++) {
    for (let x = 0; x < verts; x++) {
      const worldX = (x - GRID_SIZE / 2) * GRID_SPACING;
      const worldZ = (z - GRID_SIZE / 2) * GRID_SPACING;
      positions[p++] = worldX;
      positions[p++] = flammHeight(Math.hypot(worldX, worldZ));
      positions[p++] = worldZ;
    }
  }

  // One horizontal and one vertical segment per cell.
  const segments = GRID_SIZE * verts * 2;
  const indices = new Uint16Array(segments * 2);
  let i = 0;
  for (let z = 0; z < verts; z++) {
    for (let x = 0; x < verts; x++) {
      const v = z * verts + x;
      if (x < GRID_SIZE) {
        indices[i++] = v;
        indices[i++] = v + 1;
      }
      if (z < GRID_SIZE) {
        indices[i++] = v;
        indices[i++] = v + verts;
      }
    }
  }
  return { positions, indices };
}
