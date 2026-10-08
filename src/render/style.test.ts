import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE,
  REALISTIC,
  RETRO,
  RETRO_PALETTE,
  STYLES,
  resolveStyle,
} from './style';
import type { Style } from './style';

const PRESETS: readonly Style[] = [REALISTIC, RETRO];

describe('the style registry exposes exactly the shipped presets', () => {
  it("contains 'realistic' and 'retro' and nothing else", () => {
    expect(Object.keys(STYLES).sort()).toEqual(['realistic', 'retro']);
    expect(STYLES.realistic).toBe(REALISTIC);
    expect(STYLES.retro).toBe(RETRO);
  });

  it("defaults to 'realistic'", () => {
    expect(DEFAULT_STYLE).toBe('realistic');
  });
});

describe('resolveStyle maps any input to a usable style and reports validity', () => {
  it("treats null as the default and known", () => {
    expect(resolveStyle(null)).toEqual({ style: REALISTIC, known: true });
  });

  it('treats undefined as the default and known', () => {
    expect(resolveStyle(undefined)).toEqual({ style: REALISTIC, known: true });
  });

  it("resolves 'retro' to the retro preset", () => {
    expect(resolveStyle('retro')).toEqual({ style: RETRO, known: true });
  });

  it("resolves 'realistic' to the realistic preset", () => {
    expect(resolveStyle('realistic')).toEqual({ style: REALISTIC, known: true });
  });

  it("falls back to the default for an unknown name, flagged unknown", () => {
    expect(resolveStyle('sunrise')).toEqual({ style: REALISTIC, known: false });
  });
});

describe('render scale stays inside the valid (0, 1] range', () => {
  it('is in range for both presets', () => {
    for (const preset of PRESETS) {
      expect(preset.renderScale).toBeGreaterThan(0);
      expect(preset.renderScale).toBeLessThanOrEqual(1);
    }
  });

  it('renders the default style at full resolution', () => {
    expect(REALISTIC.renderScale).toBe(1);
    expect(RETRO.renderScale).toBeLessThan(1);
  });
});

describe('sky colours must survive shadow detection', () => {
  // gpuRenderer.ts:measureShadowDiameterCanvasPx reads the compute texture BEFORE any
  // post effect and classifies a texel as shadow with `blue <= 4` (out of 255).
  // A sky that dark in blue would be misread as shadow, so both the low and
  // high ends of the gradient must sit clearly above that threshold.
  it('keeps blue above the shadow threshold for both presets', () => {
    for (const preset of PRESETS) {
      expect(preset.sky.low[2] * 255).toBeGreaterThan(4);
      expect(preset.sky.high[2] * 255).toBeGreaterThan(4);
    }
  });
});

describe('the retro palette encodes the project limited-colour spec', () => {
  it('ships at least 8 entries', () => {
    expect(RETRO_PALETTE.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps every channel in [0, 1]', () => {
    for (const entry of RETRO_PALETTE) {
      for (const channel of entry) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('has no duplicate entries', () => {
    const keys = RETRO_PALETTE.map((rgb) => rgb.join(','));
    expect(new Set(keys).size).toBe(RETRO_PALETTE.length);
  });

  // The palette is deliberately restricted to black/charcoal neutrals and the
  // warm (red -> orange -> yellow-orange) families. No cool or magenta entry.
  it('is either near-neutral or warm-hued', () => {
    for (const [r, g, b] of RETRO_PALETTE) {
      const nearNeutral = Math.max(r, g, b) < 0.16;
      const warmHued = r >= g && g >= b;
      expect(nearNeutral || warmHued).toBe(true);
    }
  });
});

describe('physics is not stylable', () => {
  // The accretion-disk ramp lives in geodesic3d.wgsl and is shared by every
  // style; a Style must never grow a disk (or any physics) parameter.
  it('carries no disk-related key in either preset', () => {
    expect(Object.keys(REALISTIC)).not.toContain('disk');
    expect(Object.keys(RETRO)).not.toContain('disk');
  });
});

describe('wireframe presentation', () => {
  it('keeps alpha in (0, 1] for both presets', () => {
    for (const preset of PRESETS) {
      expect(preset.wire.alpha).toBeGreaterThan(0);
      expect(preset.wire.alpha).toBeLessThanOrEqual(1);
    }
  });

  // Exact values taken from grid.frag of the reference repository: neutral
  // grey at 0.7 opacity is the current Flamm wireframe look.
  it('locks the realistic wireframe to (0.5, 0.5, 0.5) at 0.7', () => {
    expect(REALISTIC.wire.color).toEqual([0.5, 0.5, 0.5]);
    expect(REALISTIC.wire.alpha).toBe(0.7);
  });
});

describe('post-processing flags match the presentation intent', () => {
  it('disables every post effect in the realistic preset', () => {
    expect(REALISTIC.post).toEqual({
      palette: false,
      dither: false,
      scanlines: false,
      vignette: false,
    });
  });

  it('enables palette quantisation and dithering in the retro preset', () => {
    expect(RETRO.post.palette).toBe(true);
    expect(RETRO.post.dither).toBe(true);
  });
});

describe('UI colours are CSS hex strings', () => {
  it('matches #rrggbb for every field of both presets', () => {
    for (const preset of PRESETS) {
      for (const value of Object.values(preset.ui)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe('realistic sky values are a regression lock', () => {
  // Regression lock: phase 2 moves these literals into a WGSL uniform, and it
  // must not be able to silently change the default look while doing so.
  it('equals the current hard-coded gradient and grid constants', () => {
    expect(REALISTIC.sky.low).toEqual([0.010, 0.016, 0.034]);
    expect(REALISTIC.sky.high).toEqual([0.026, 0.040, 0.070]);
    expect(REALISTIC.sky.gridColor).toEqual([0.030, 0.075, 0.120]);
  });
});
