import type { CameraState } from './gpuRenderer';

/**
 * View-projection matrix for the spacetime-grid overlay.
 *
 * The overlay is drawn in a normal 3D pass, but the image it sits on is
 * produced by a compute shader that builds each camera ray by hand:
 *
 *     dir = fwd + ndc.x * aspect * tanHalf * right + ndc.y * tanHalf * up
 *
 * so this matrix is not free to pick any projection it likes -- it has to
 * reproduce that mapping exactly, or the wireframe will not line up with the
 * scene it is supposed to describe. For a world point p, writing
 *
 *     t     = p - pos
 *     depth = dot(fwd, t)                 (positive in front of the camera)
 *     xv    = dot(right, t)
 *     yv    = dot(up, t)
 *
 * the shader's ray at NDC (x, y) is the direction (x * aspect * tanHalf,
 * y * tanHalf, 1) in view space, hence:
 *
 *     clip.x = xv / (aspect * tanHalf)
 *     clip.y = yv / tanHalf
 *     clip.w = depth
 *
 * which is what the rows below encode. WebGPU resolves the third row as
 * z_ndc = clip.z / clip.w, so it is parameterised to hit 0 at `near` and 1 at
 * `far`.
 */

/** Near plane in rs. Only geometry closer than this is clipped. */
export const NEAR = 0.1;
/** Far plane in rs. The lattice spans ~10 rs and the camera sits at ~40. */
export const FAR = 1000;

function dot(a: readonly number[], b: readonly [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Builds the 4x4 matrix, stored column-major to match WGSL's `mat4x4<f32>`
 * (WGSL multiplies `M * v` treating the storage order as columns).
 */
export function buildViewProjection(
  camera: CameraState,
  near: number = NEAR,
  far: number = FAR,
): Float32Array {
  const { pos, right, up, fwd, tanHalfFov, aspect } = camera;

  const width = aspect * tanHalfFov;
  const depthScale = far / (far - near);
  const depthBias = (-near * far) / (far - near);

  // Row-major rows; transposed into columns below.
  const rows: number[][] = [
    [
      right[0] / width,
      right[1] / width,
      right[2] / width,
      -dot(right, pos) / width,
    ],
    [up[0] / tanHalfFov, up[1] / tanHalfFov, up[2] / tanHalfFov, -dot(up, pos) / tanHalfFov],
    [
      depthScale * fwd[0],
      depthScale * fwd[1],
      depthScale * fwd[2],
      depthBias - depthScale * dot(fwd, pos),
    ],
    [fwd[0], fwd[1], fwd[2], -dot(fwd, pos)],
  ];

  const out = new Float32Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      out[col * 4 + row] = rows[row][col];
    }
  }
  return out;
}

/** Reference helper: multiplies a column-major matrix by a homogeneous point. */
export function transformPoint(m: Float32Array, x: number, y: number, z: number): number[] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}
