/**
 * Pure sizing math for the offscreen compute/storage target.
 *
 * The retro preset renders at a fraction of the canvas (`Style.renderScale`)
 * and lets the present passes upscale it, so the storage texture is NOT the
 * canvas size. Like `style.ts` and `styleUniforms.ts` this module is
 * dependency-free, DOM-free and GPU-free: it only maps numbers to numbers, so
 * vitest can lock the formula without a WebGPU adapter.
 *
 * The renderer calls this from `ensureTargets()` (src/render/gpuRenderer.ts)
 * with the current style's `renderScale`, so switching styles at runtime
 * re-runs the same sizing math. Nothing here reads a URL parameter, a key
 * binding or a Style object directly -- only the scale number.
 */

/** Canvas backing-store size and style render scale -> storage texture size. */
export interface ScaledSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Rounds one canvas dimension down to the storage texture's dimension.
 *
 * `Math.max(1, ...)` exists because a dimension of 1 CSS pixel at
 * `renderScale = 0.25` rounds to 0, and a GPU texture must be at least 1x1.
 * At `scale = 1` the expression is the identity for every size the canvas can
 * report: `resizeCanvasToDisplaySize()` already returns integers >= 1, so
 * `Math.round(w * 1) === w`.
 */
export function scaledDimension(canvasDimension: number, scale: number): number {
  return Math.max(1, Math.round(canvasDimension * scale));
}

/**
 * Storage texture size for a canvas of this size and this render scale.
 *
 * Both axes use the same formula, so the aspect ratio is preserved exactly
 * when the scale lands on integers and up to rounding otherwise (the same
 * rounding every GPU makes when an odd dimension is divided).
 */
export function scaledTargetSize(canvasWidth: number, canvasHeight: number, scale: number): ScaledSize {
  return {
    width: scaledDimension(canvasWidth, scale),
    height: scaledDimension(canvasHeight, scale),
  };
}

/**
 * Converts a length measured in storage-texture TEXELS on the centre row back
 * into CANVAS pixels -- the inverse of `scaledTargetSize` for one axis.
 *
 * `measureShadowDiameterCanvasPx()` (src/render/gpuRenderer.ts) counts texels
 * of the offscreen compute texture, while the self-check arithmetic in
 * lensing3d.ts is written in canvas pixels. The two units coincide exactly at
 * `renderScale = 1` (factor 1, so the default style's reported number is
 * unchanged) and differ by 1 / scale below it -- 4x at the retro preset's
 * 0.25. Converting at the API boundary keeps that difference out of callers.
 *
 * The result is fractional whenever the rounded texel width does not divide
 * the canvas width evenly (e.g. a 982 px canvas at scale 0.25 is 246 texels,
 * not 245.5); reporting the honest factor beats pretending the scale is exact.
 * Returns 0 for a degenerate input instead of NaN/Infinity.
 */
export function texelsToCanvasPixels(
  texels: number,
  texelWidth: number,
  canvasWidth: number,
): number {
  if (texelWidth <= 0 || canvasWidth <= 0) return 0;
  return (texels * canvasWidth) / texelWidth;
}
