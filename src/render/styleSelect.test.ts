import { describe, expect, it } from 'vitest';
import mainSource from '../main.ts?raw';
import { REALISTIC, RETRO, type Style } from './style';
import { initialStyleFrom, nextStyle, styleWarningNote, toggleCrt } from './styleSelect';

const WARNING = ' Unknown style value — falling back to realistic.';

const PRESETS: readonly Style[] = [REALISTIC, RETRO];

/** The four post flags of a style, as one comparable object. */
function postOf(style: Style): Style['post'] {
  return style.post;
}

describe('initialStyleFrom resolves the ?style= parameter', () => {
  it("selects 'retro' from a valid value", () => {
    const choice = initialStyleFrom(new URLSearchParams('?style=retro'));
    expect(choice).toEqual({ style: RETRO, known: true });
  });

  it("selects 'realistic' from a valid value", () => {
    const choice = initialStyleFrom(new URLSearchParams('?style=realistic'));
    expect(choice).toEqual({ style: REALISTIC, known: true });
  });

  it('falls back to the default when the parameter is absent, and says so', () => {
    // Absent is not a typo: default style, known.
    expect(initialStyleFrom(new URLSearchParams(''))).toEqual({
      style: REALISTIC,
      known: true,
    });
    expect(initialStyleFrom(new URLSearchParams('?mode=3d'))).toEqual({
      style: REALISTIC,
      known: true,
    });
  });

  it('falls back to the default for an unknown value, flagged for a warning', () => {
    // known:false is what main.ts turns into the on-screen note; the style
    // itself is still the usable default, so nothing downstream can crash on
    // an invalid URL.
    for (const bad of ['sunrise', 'RETRO', 'Retro', 'retro ', '']) {
      const choice = initialStyleFrom(new URLSearchParams(`?style=${encodeURIComponent(bad)}`));
      expect(choice.known, `style=${bad}`).toBe(false);
      expect(choice.style, `style=${bad}`).toBe(REALISTIC);
    }
  });

  it('reads only the style key and ignores the rest of the query', () => {
    const choice = initialStyleFrom(new URLSearchParams('?mode=3d&check=1&style=retro'));
    expect(choice).toEqual({ style: RETRO, known: true });
  });
});

describe('styleWarningNote turns known:false into the visible status note', () => {
  // initialStyleFrom() already pins known:false for an invalid ?style=; this
  // pins the other half of that wiring -- that main.ts' note actually gets
  // built from it, and only where the warning makes sense (3D mode).

  it('reports the warning for an invalid style in 3D mode', () => {
    const choice = initialStyleFrom(new URLSearchParams('?style=sunrise'));
    expect(choice.known).toBe(false);
    expect(styleWarningNote('3d', choice.known)).toBe(WARNING);
  });

  it('says nothing in 2D mode, even for an invalid style', () => {
    // ?style= is meaningless on the 2D canvas (it draws without style
    // uniforms), so a warning there would be noise.
    const choice = initialStyleFrom(new URLSearchParams('?style=sunrise'));
    expect(choice.known).toBe(false);
    expect(styleWarningNote('2d', choice.known)).toBe('');
  });

  it('says nothing when the style resolved cleanly, in either mode', () => {
    for (const query of ['', '?style=retro', '?style=realistic']) {
      const choice = initialStyleFrom(new URLSearchParams(query));
      expect(choice.known, query).toBe(true);
      expect(styleWarningNote('3d', choice.known), query).toBe('');
      expect(styleWarningNote('2d', choice.known), query).toBe('');
    }
  });

  it('is appended verbatim by main.ts, which is what makes it visible', () => {
    // The helper only matters if main.ts feeds it into setStatus(), and the
    // text must stay owned by the helper (pinned above) instead of being
    // re-spelled in main.ts -- otherwise main.ts could drift away from what
    // these tests actually check.
    expect(mainSource).toMatch(/note \+= styleWarningNote\(mode, initialStyle\.known\)/);
    expect(mainSource).toMatch(/setStatus\(probe, note\)/);
    expect(mainSource).not.toMatch(/Unknown style value/);
  });
});

describe('nextStyle (the s key) flips between the shipped presets', () => {
  it('goes realistic -> retro -> realistic', () => {
    expect(nextStyle(REALISTIC)).toBe(RETRO);
    expect(nextStyle(nextStyle(REALISTIC))).toBe(REALISTIC);
  });

  it('goes retro -> realistic', () => {
    expect(nextStyle(RETRO)).toBe(REALISTIC);
  });

  it('returns a preset, never a modified copy', () => {
    for (const preset of PRESETS) {
      expect(nextStyle(preset)).toBe(preset === REALISTIC ? RETRO : REALISTIC);
    }
  });

  it('restores the target preset whole, including its CRT state', () => {
    // Documented consequence: switching away and back discards a `c` toggle.
    const crtOff: Style = { ...RETRO, post: { ...RETRO.post, scanlines: false, vignette: false } };
    expect(nextStyle(crtOff)).toBe(REALISTIC);
    expect(nextStyle(nextStyle(crtOff))).toBe(RETRO);
    expect(nextStyle(nextStyle(crtOff)).post.scanlines).toBe(true);
  });
});

describe('toggleCrt (the c key) touches only the CRT layer', () => {
  it('is a no-op in the realistic style: same object, all flags still false', () => {
    // The recommendation we ship: with no retro core there is no CRT layer to
    // show, so `c` in realistic changes nothing on screen. Reference equality
    // is what lensing3d.activateStyle() checks to skip the whole switch.
    const after = toggleCrt(REALISTIC);
    expect(after).toBe(REALISTIC);
    expect(postOf(after)).toEqual({
      palette: false,
      dither: false,
      scanlines: false,
      vignette: false,
    });
    // Repeated presses stay no-ops instead of flipping into a state where
    // scanlines would show over a non-quantised image.
    expect(toggleCrt(after)).toBe(REALISTIC);
  });

  it('turns the retro CRT layer off, keeping palette and dither on', () => {
    const off = toggleCrt(RETRO);
    expect(off).not.toBe(RETRO);
    expect(postOf(off)).toEqual({
      palette: true,
      dither: true,
      scanlines: false,
      vignette: false,
    });
  });

  it('turns it back on with a second press (a real toggle)', () => {
    const backOn = toggleCrt(toggleCrt(RETRO));
    expect(postOf(backOn)).toEqual(postOf(RETRO));
    expect(backOn.post).toEqual({
      palette: true,
      dither: true,
      scanlines: true,
      vignette: true,
    });
  });

  it('never mutates the style it was given', () => {
    const retroSnapshot = JSON.stringify(RETRO);
    const realisticSnapshot = JSON.stringify(REALISTIC);
    toggleCrt(RETRO);
    toggleCrt(REALISTIC);
    expect(JSON.stringify(RETRO)).toBe(retroSnapshot);
    expect(JSON.stringify(REALISTIC)).toBe(realisticSnapshot);
  });

  it('leaves everything outside post untouched', () => {
    const off = toggleCrt(RETRO);
    expect(off.name).toBe(RETRO.name);
    expect(off.renderScale).toBe(RETRO.renderScale);
    expect(off.sky).toBe(RETRO.sky);
    expect(off.wire).toBe(RETRO.wire);
    expect(off.ui).toBe(RETRO.ui);
  });
});
