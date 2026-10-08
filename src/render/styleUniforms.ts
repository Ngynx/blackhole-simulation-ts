/**
 * Pure builders that turn a `Style` into the exact bytes each style-consuming
 * uniform buffer holds.
 *
 * Like `style.ts`, this module is dependency-free, DOM-free and GPU-free: it
 * only produces `Float32Array`s, so unit tests can assert byte layouts
 * without a WebGPU adapter. The renderer uploads the arrays verbatim.
 *
 * WGSL LAYOUT CONTRACT
 * --------------------
 * The uniform address space aligns every member to its RequiredAlignOf (16
 * for vec3/vec4/matrices, 8 for vec2, 4 for scalars) and rounds a struct's
 * total size up to a multiple of 16, so every phase-2 field sits on a vec4
 * boundary and the phase-3 vec2 additions land at byte 16 of their struct
 * with 8 bytes of implicit padding behind them. On the TS side the mirror is
 * a flat `Float32Array` of little-endian f32, one entry per WGSL scalar.
 * Offsets below are byte offsets on the GPU; the equivalent TS index is
 * `byte / 4`.
 *
 * Each struct must match its shader declaration comment exactly:
 *
 *   SkyStyleUniform -- src/shaders/geodesic3d.wgsl, group 0 binding 3,
 *                      3 x vec4 = 48 bytes:
 *     byte   0  float 0   lowGrid.rgb    sky.low              gradient bottom
 *     byte  12  float 3   lowGrid.a      sky.gridStrength     grid multiplier
 *     byte  16  float 4   highStars.rgb  sky.high             gradient top
 *     byte  28  float 7   highStars.a    sky.proceduralStars  1 = on, 0 = off
 *     byte  32  float 8   gridTint.rgb   sky.gridColor        grid tint
 *     byte  44  float 11  gridTint.a     reserved, always 0
 *
 *   WireStyleUniform -- src/shaders/grid.wgsl, group 0 binding 2,
 *                       vec4 + vec2; the struct's 24 bytes round up to 32:
 *     byte   0  float 0   colorAlpha.rgb wire.color           wireframe tint
 *     byte  12  float 3   colorAlpha.a   wire.alpha           base opacity
 *     byte  16  float 4   invCanvas.x    1 / canvas width      texel-centre UV
 *     byte  20  float 5   invCanvas.y    1 / canvas height     texel-centre UV
 *     byte  24..31        implicit padding (uniform structs round to 16)
 *
 *   PostStyleFlags -- src/shaders/blit.wgsl, group 0 binding 1,
 *                     vec4 + vec2; the struct's 24 bytes round up to 32:
 *     byte   0  float 0   flags.x        post.palette         1 = on
 *     byte   4  float 1   flags.y        post.dither
 *     byte   8  float 2   flags.z        post.scanlines
 *     byte  12  float 3   flags.w        post.vignette
 *     byte  16  float 4   invCanvas.x    1 / canvas width      texel-centre UV
 *     byte  20  float 5   invCanvas.y    1 / canvas height     texel-centre UV
 *     byte  24..31        implicit padding (uniform structs round to 16)
 *
 *   PaletteRamp -- src/shaders/blit.wgsl, group 0 binding 3,
 *                  array<vec4<f32>, 12>; a vec4 element has a 16-byte
 *                  stride, so 12 entries are exactly 192 bytes, no padding:
 *     byte   0  vec4 0    entries[0]      RETRO_PALETTE[0]      ramp entry 0
 *     byte  16  vec4 1    entries[1]      RETRO_PALETTE[1]      ramp entry 1
 *     ...
 *     byte 176  vec4 11   entries[11]     RETRO_PALETTE[11]     ramp entry 11
 *     (each entry's alpha is written as 1.0; blit.wgsl reads .rgb only)
 *     Entry i sits at byte i * 16 = float offset i * 4.
 *
 * Booleans travel as 0.0/1.0: `bool` is not host-shareable, so it cannot sit
 * in a uniform buffer at all, and `flag > 0.5` reads unambiguously.
 *
 * invCanvas is NOT style data: it depends on the canvas backing store, not on
 * the preset, so the builders leave it at zero and the renderer rewrites those
 * 8 bytes at *_INV_CANVAS_OFFSET -- on every resize (ensureTargets) and after
 * every setStyle(), which rebuilds the whole wire/post buffer first (see
 * gpuRenderer.ts).
 */

import type { RGB, Style } from './style';

/** Element counts of each uniform buffer (multiply by 4 for bytes). */
export const SKY_UNIFORM_FLOATS = 12;
export const WIRE_UNIFORM_FLOATS = 8;
export const POST_UNIFORM_FLOATS = 8;
/**
 * Palette ramp size: 12 vec4 entries = 48 floats = 192 bytes. PALETTE_ENTRIES
 * mirrors `array<vec4<f32>, 12>` in PaletteRamp (blit.wgsl) and is checked
 * against RETRO_PALETTE.length by the tests, so style.ts stays the only place
 * the ramp is spelled out.
 */
export const PALETTE_ENTRIES = 12;
export const PALETTE_UNIFORM_FLOATS = PALETTE_ENTRIES * 4;

/** Byte offset of `invCanvas` inside WireStyleUniform (grid.wgsl). */
export const WIRE_INV_CANVAS_OFFSET = 16;
/** Byte offset of `invCanvas` inside PostStyleFlags (blit.wgsl). */
export const POST_INV_CANVAS_OFFSET = 16;

/** true -> 1.0, false -> 0.0, the WGSL representation of a style flag. */
function flag(value: boolean): number {
  return value ? 1 : 0;
}

/**
 * Builds the compute pass's sky uniform (see layout table above).
 * Returns a fresh array on every call; the input style is never mutated.
 */
export function buildSkyStyleUniform(style: Style): Float32Array {
  const bytes = new Float32Array(SKY_UNIFORM_FLOATS);
  bytes.set(style.sky.low, 0); //        offset 0   lowGrid.rgb
  bytes[3] = style.sky.gridStrength; //  offset 12  lowGrid.a
  bytes.set(style.sky.high, 4); //       offset 16  highStars.rgb
  bytes[7] = flag(style.sky.proceduralStars); // offset 28 highStars.a
  bytes.set(style.sky.gridColor, 8); //  offset 32  gridTint.rgb
  bytes[11] = 0; //                      offset 44  gridTint.a (reserved)
  return bytes;
}

/**
 * Builds the grid pass's wireframe uniform (see layout table above).
 * Returns a fresh array on every call; the input style is never mutated.
 */
export function buildWireStyleUniform(style: Style): Float32Array {
  const bytes = new Float32Array(WIRE_UNIFORM_FLOATS);
  bytes.set(style.wire.color, 0); //     offset 0   colorAlpha.rgb
  bytes[3] = style.wire.alpha; //        offset 12  colorAlpha.a
  // floats 4..5 (byte 16, invCanvas) stay 0: the renderer overwrites them
  // with 1 / canvas size on every resize (WIRE_INV_CANVAS_OFFSET).
  return bytes;
}

/**
 * Builds the blit pass's post-flags uniform (see layout table above).
 * blit.wgsl gates each phase-4 effect behind its own flag; the default preset
 * sends all zeros, which keeps the shader on its plain-identity path.
 * Returns a fresh array on every call; the input style is never mutated.
 */
export function buildPostStyleUniform(style: Style): Float32Array {
  const bytes = new Float32Array(POST_UNIFORM_FLOATS);
  bytes[0] = flag(style.post.palette); //    offset 0   flags.x
  bytes[1] = flag(style.post.dither); //     offset 4   flags.y
  bytes[2] = flag(style.post.scanlines); //  offset 8   flags.z
  bytes[3] = flag(style.post.vignette); //   offset 12  flags.w
  // floats 4..5 (byte 16, invCanvas) stay 0: the renderer overwrites them
  // with 1 / canvas size on every resize (POST_INV_CANVAS_OFFSET).
  return bytes;
}

/**
 * Builds the blit pass's palette-ramp uniform (see layout table above).
 *
 * `palette` is RETRO_PALETTE today: the ramp's single source of truth lives
 * in style.ts and is passed in, so it is never re-typed here nor in WGSL.
 * Entry i lands at float offset i * 4 (byte i * 16, the uniform stride of a
 * vec4 element): rgb copied from the ramp, alpha pinned to 1 because
 * blit.wgsl reads .rgb only and an uninitialized slot would be a silent 0.
 * The Float32Array conversion rounds each channel to f32, which is exactly
 * what the GPU sees.
 *
 * Throws when the ramp length differs from the fixed WGSL array: the buffer
 * size is constant, so a mismatch would otherwise only surface as a WebGPU
 * bind-group validation error in the browser, never in CI.
 * Returns a fresh array on every call; the input palette is never mutated.
 */
export function buildPaletteUniform(palette: readonly RGB[]): Float32Array {
  if (palette.length !== PALETTE_ENTRIES) {
    throw new Error(`palette must hold ${PALETTE_ENTRIES} entries, got ${palette.length}`);
  }
  const bytes = new Float32Array(PALETTE_UNIFORM_FLOATS);
  for (let i = 0; i < PALETTE_ENTRIES; i++) {
    bytes.set(palette[i], i * 4); //  offset i*16      entries[i].rgb
    bytes[i * 4 + 3] = 1; //          offset i*16 + 12 entries[i].a (unused)
  }
  return bytes;
}

/**
 * Builds the vec2 both present passes turn into UVs:
 * `uv = fragCoord.xy * invCanvas` -- @builtin(position) is already the pixel
 * centre, so no half pixel is added on top.
 *
 * Written straight into the wire/post buffers at the *_INV_CANVAS_OFFSET
 * byte offsets whenever the canvas backing store changes; unlike the builders
 * above it is canvas data, not style data.
 */
export function buildInvCanvasUniform(canvasWidth: number, canvasHeight: number): Float32Array {
  return new Float32Array([1 / canvasWidth, 1 / canvasHeight]);
}
