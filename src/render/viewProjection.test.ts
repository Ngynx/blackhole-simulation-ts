import { describe, expect, it } from 'vitest';
import type { CameraState } from './gpuRenderer';
import { FAR, NEAR, buildViewProjection, transformPoint } from './viewProjection';

const TAN_HALF = Math.tan((40 * Math.PI) / 180 / 2);
const ASPECT = 1.6;

/**
 * Absolute tolerance for the NDC and depth assertions.
 *
 * The matrix is a Float32Array -- that is what WGSL's `mat4x4<f32>` takes and
 * what the GPU will actually use -- so each coefficient carries ~6e-8 of
 * relative error, and every clip coordinate it produces is a difference of
 * world-space terms of magnitude ~40 (the camera distance). Two terms of that
 * size cancelling each other leave ~40 * 6e-8 ≈ 2.4e-6 of noise per term,
 * roughly 2e-5 once the three spatial terms and the w division are combined.
 *
 * That is not slack in this test: the GPU performs exactly these operations in
 * f32, so it is the accuracy the overlay really gets. 5e-4 of NDC is one
 * two-thousandth of the screen -- below a pixel, and an order of magnitude of
 * headroom over the residual so the assertion does not go knife-edge.
 */
const F32_EPS = 5e-4;

/**
 * Builds a camera with the same orbit convention as buildCamera() in
 * lensing3d.ts. The basis, not the projection, is what makes this awkward:
 * a hand-written "tilted" basis that is not exactly orthonormal would make
 * the projection look wrong when it is not.
 */
function orbitCamera(
  distance: number,
  azimuth: number,
  elevation: number,
): CameraState {
  const cosEl = Math.cos(elevation);
  const pos: [number, number, number] = [
    distance * cosEl * Math.cos(azimuth),
    distance * Math.sin(elevation),
    distance * cosEl * Math.sin(azimuth),
  ];
  const len = Math.hypot(pos[0], pos[1], pos[2]);
  const fwd: [number, number, number] = [-pos[0] / len, -pos[1] / len, -pos[2] / len];

  // right = normalize(cross(fwd, worldUp)) with worldUp = (0, 1, 0).
  const rx = -fwd[2];
  const rz = fwd[0];
  const rlen = Math.hypot(rx, rz);
  const right: [number, number, number] = [rx / rlen, 0, rz / rlen];
  const up: [number, number, number] = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ];

  return { pos, right, up, fwd, tanHalfFov: TAN_HALF, aspect: ASPECT };
}

const cameras: ReadonlyArray<readonly [string, CameraState]> = [
  ['straight-on', orbitCamera(40, 0, 0)],
  ['tilted', orbitCamera(40, -0.55, 0.5)],
  ['near-equator', orbitCamera(40, 2.1, 0.03)],
];

/**
 * The overlay only lines up with the computed image if this matrix inverts the
 * shader's ray construction, so that is the property under test.
 */
function rayPoint(camera: CameraState, ndcX: number, ndcY: number, depth: number): [number, number, number] {
  const { fwd, right, up, pos, tanHalfFov, aspect } = camera;
  const d = [
    fwd[0] + ndcX * aspect * tanHalfFov * right[0] + ndcY * tanHalfFov * up[0],
    fwd[1] + ndcX * aspect * tanHalfFov * right[1] + ndcY * tanHalfFov * up[1],
    fwd[2] + ndcX * aspect * tanHalfFov * right[2] + ndcY * tanHalfFov * up[2],
  ];
  return [pos[0] + depth * d[0], pos[1] + depth * d[1], pos[2] + depth * d[2]];
}

for (const [name, camera] of cameras) {
  describe(`buildViewProjection (${name})`, () => {
    const m = buildViewProjection(camera);

    it('reproduces the shader ray direction at every NDC sample', () => {
      for (const x of [-1, -0.3, 0, 0.42, 1]) {
        for (const y of [-1, 0, 1]) {
          const clip = transformPoint(m, ...rayPoint(camera, x, y, 12));
          const [cx, cy, , cw] = clip;
          expect(Math.abs(cw - 12)).toBeLessThan(F32_EPS);
          expect(Math.abs(cx / cw - x)).toBeLessThan(F32_EPS);
          expect(Math.abs(cy / cw - y)).toBeLessThan(F32_EPS);
        }
      }
    });

    it('maps the near and far planes to depth 0 and 1', () => {
      const depthAt = (depth: number): number => {
        const p = rayPoint(camera, 0, 0, depth);
        const clip = transformPoint(m, p[0], p[1], p[2]);
        return clip[2] / clip[3];
      };
      // At NEAR the third row is an exact cancellation (depthScale * near +
      // depthBias = 0), so this is where the f32 noise lands hardest: around
      // 2e-5 observed against a 5e-4 bound.
      expect(Math.abs(depthAt(NEAR))).toBeLessThan(F32_EPS);
      expect(Math.abs(depthAt(FAR) - 1)).toBeLessThan(F32_EPS);
      expect(depthAt(40)).toBeGreaterThan(0);
      expect(depthAt(40)).toBeLessThan(1);
    });

    it('gives points behind the camera a negative w, so they clip away', () => {
      const p = rayPoint(camera, 0, 0, -5);
      const clip = transformPoint(m, p[0], p[1], p[2]);
      expect(clip[3]).toBeLessThan(0);
    });

    it('is column-major, as WGSL mat4x4<f32> expects', () => {
      const p = rayPoint(camera, 0.2, -0.4, 9);
      const clip = transformPoint(m, p[0], p[1], p[2]);
      const colMajor = (row: number): number =>
        m[row] * p[0] + m[4 + row] * p[1] + m[8 + row] * p[2] + m[12 + row];
      expect(colMajor(0)).toBeCloseTo(clip[0], 6);
      expect(colMajor(1)).toBeCloseTo(clip[1], 6);
      expect(colMajor(3)).toBeCloseTo(clip[3], 6);
    });
  });
}
