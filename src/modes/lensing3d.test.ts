/**
 * The 3D mode's on-screen hint is part of the feature: it is where the s/c
 * bindings are documented and where the active style is visible. These tests
 * pin that text so the bindings cannot silently disappear from the UI.
 *
 * The module also exercises the renderer's import graph (wgsl ?raw, physics)
 * under vitest, which is why nothing WebGPU-related may run at import time.
 */
import { describe, expect, it } from 'vitest';
import { lensing3dHint } from './lensing3d';
import { REALISTIC, RETRO, type Style } from '../render/style';

describe('lensing3dHint documents the active style and every binding', () => {
  it('keeps the pre-existing drag/wheel/r bindings', () => {
    for (const style of [REALISTIC, RETRO]) {
      const hint = lensing3dHint(style);
      expect(hint).toContain('drag: orbit');
      expect(hint).toContain('wheel: zoom');
      expect(hint).toContain('r: reset view');
    }
  });

  it('shows the active style name on the s binding', () => {
    expect(lensing3dHint(REALISTIC)).toContain('s: style (realistic)');
    expect(lensing3dHint(RETRO)).toContain('s: style (retro)');
  });

  it('documents the CRT mapping for the retro style', () => {
    // The chosen product behaviour: `c` toggles scanlines + vignette only,
    // and the retro core (palette + dither) stays on. Stated on screen so it
    // is discoverable without reading the source.
    const hint = lensing3dHint(RETRO);
    expect(hint).toContain('c: crt (scanlines+vignette, palette+dither stay)');
    expect(hint).not.toContain('palette off');
  });

  it('states that c is a retro-only no-op in the realistic style', () => {
    const hint = lensing3dHint(REALISTIC);
    expect(hint).toContain('c: crt (retro only)');
  });

  it('keeps the same CRT text when the CRT layer has been toggled off', () => {
    const crtOff: Style = { ...RETRO, post: { ...RETRO.post, scanlines: false, vignette: false } };
    expect(lensing3dHint(crtOff)).toBe(lensing3dHint(RETRO));
  });
});
