import { describe, expect, it } from 'vitest';
import { REALISTIC, RETRO } from './style';
import { scaledDimension, scaledTargetSize, texelsToCanvasPixels } from './renderScale';

describe('scaledDimension', () => {
  it('is the identity at renderScale 1 for every canvas size', () => {
    // The default preset must produce exactly today's texture: the canvas
    // only ever reports integers >= 1, so round(w * 1) === w.
    for (const w of [1, 2, 3, 7, 64, 333, 982, 1512, 1920, 4096]) {
      expect(scaledDimension(w, 1)).toBe(w);
    }
  });

  it('rounds the canvas dimension at renderScale 0.25', () => {
    expect(scaledDimension(1920, 0.25)).toBe(480);
    expect(scaledDimension(1080, 0.25)).toBe(270);
    expect(scaledDimension(1512, 0.25)).toBe(378);
    expect(scaledDimension(333, 0.25)).toBe(83); // 83.25 rounds down
    expect(scaledDimension(982, 0.25)).toBe(246); // 245.5 rounds half-up
  });

  it('never returns 0, so a 1px canvas still yields a 1x1 texture', () => {
    expect(scaledDimension(1, 0.25)).toBe(1); // round(0.25) = 0 -> clamped
    expect(scaledDimension(2, 0.25)).toBe(1);
    expect(scaledDimension(3, 0.25)).toBe(1);
    expect(scaledDimension(1, 1)).toBe(1);
  });
});

describe('scaledTargetSize', () => {
  it('returns the canvas size unchanged for the default style', () => {
    const size = scaledTargetSize(1512, 982, REALISTIC.renderScale);
    expect(size).toEqual({ width: 1512, height: 982 });
  });

  it('scales both axes by the retro preset factor', () => {
    const size = scaledTargetSize(1920, 1080, RETRO.renderScale);
    expect(RETRO.renderScale).toBe(0.25);
    expect(size).toEqual({ width: 480, height: 270 });
    // Aspect ratio survives: both axes are divided by exactly 4 here.
    expect(size.width / size.height).toBeCloseTo(1920 / 1080, 10);
  });

  it('keeps odd canvas sizes at least 1x1 and aspect-adjacent', () => {
    const size = scaledTargetSize(1001, 333, RETRO.renderScale);
    expect(size).toEqual({ width: 250, height: 83 });
    // 1001/333 = 3.006; 250/83 = 3.012 -- rounding only, no axis flips.
    expect(size.width / size.height).toBeCloseTo(1001 / 333, 1);
  });
});

describe('texelsToCanvasPixels keeps the shadow measurement unit-consistent', () => {
  // measureShadowDiameterCanvasPx() counts storage texels; the self-check
  // arithmetic in lensing3d.ts is in canvas pixels. This is the boundary
  // conversion, covered at both scales the app can render at.

  it('is the identity at renderScale 1, so the default style reports as before', () => {
    // 118 here is an arbitrary fixture count, NOT a shadow measurement: the
    // self-check's real figure is viewport-dependent (see lensing3d.ts) and
    // was measured at 84 in a 756x469 viewport. At renderScale 1 the texel
    // count and the canvas-pixel count are the same number.
    expect(texelsToCanvasPixels(118, 1512, 1512)).toBe(118);
    expect(texelsToCanvasPixels(1, 1, 1)).toBe(1);
    // Any canvas size, as long as the texture IS the canvas.
    expect(texelsToCanvasPixels(57, 982, 982)).toBe(57);
  });

  it('expands by 4x at the retro preset scale of 0.25', () => {
    const target = scaledTargetSize(1920, 1080, RETRO.renderScale);
    expect(target).toEqual({ width: 480, height: 270 });
    expect(texelsToCanvasPixels(118, target.width, 1920)).toBe(472);
    expect(texelsToCanvasPixels(480, target.width, 1920)).toBe(1920);
    expect(texelsToCanvasPixels(1, target.width, 1920)).toBe(4);
  });

  it('is exact per scale for both shipped presets', () => {
    // Both scales are what they claim: the conversion must match 1/scale.
    expect(texelsToCanvasPixels(40, 1512, 1512)).toBe(40 / REALISTIC.renderScale);
    const retroTarget = scaledTargetSize(1512, 982, RETRO.renderScale);
    expect(retroTarget.width).toBe(378);
    expect(texelsToCanvasPixels(40, retroTarget.width, 1512)).toBe(40 / RETRO.renderScale);
  });

  it('reports the honest factor when the rounded texel width is not exact', () => {
    // 982 * 0.25 = 245.5 -> 246 texels: the factor is 982/246, not 4, and a
    // fractional canvas length is more truthful than a rounded lie.
    const target = scaledTargetSize(982, 999, RETRO.renderScale);
    expect(target.width).toBe(246);
    expect(texelsToCanvasPixels(100, target.width, 982)).toBeCloseTo((100 * 982) / 246, 10);
    expect(texelsToCanvasPixels(100, target.width, 982) % 1).not.toBe(0);
  });

  it('returns 0 for a degenerate texture instead of NaN or Infinity', () => {
    expect(texelsToCanvasPixels(10, 0, 1920)).toBe(0);
    expect(texelsToCanvasPixels(10, 480, 0)).toBe(0);
    expect(texelsToCanvasPixels(10, -1, 1920)).toBe(0);
  });
});
