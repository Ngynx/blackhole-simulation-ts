/**
 * Locks the page chrome to `Style.ui`.
 *
 * Two promises are at stake:
 *  1. byte identity -- the default load must paint exactly the colours
 *     index.html hard-coded before styles existed;
 *  2. no drift -- the `:root` declarations, the TS preset and what
 *     `applyUiStyle()` writes at runtime are three views of one truth, and
 *     this file makes a change to any one of them fail here first.
 */
import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import { REALISTIC, RETRO } from './style';
import type { UiStyle } from './style';
import {
  PANEL_VEIL_ALPHA,
  PANEL_VEIL_VARIABLE,
  UI_CSS_VARIABLES,
  applyUiStyle,
  hexToRgba,
  type CssRoot,
} from './uiStyle';

/** index.html's `:root` block as custom-property name -> declared value. */
function declaredRootVariables(source: string): Record<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(source.replace(/\/\*[\s\S]*?\*\//g, ''));
  expect(block, 'index.html no longer has a :root block').not.toBeNull();
  const declared: Record<string, string> = {};
  for (const entry of (block?.[1] ?? '').split(';')) {
    const match = /^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/.exec(entry);
    if (match) declared[match[1]] = match[2];
  }
  return declared;
}

/**
 * The exact colour literals index.html hard-coded before phase 5 moved them
 * behind custom properties -- the "before" snapshot of the default chrome.
 * `panel` appears here as the banner's translucent form because that is how
 * the old stylesheet spelled it; the opaque `#0a0c12` base is asserted
 * through REALISTIC.ui below.
 */
const PREVIOUS_HARD_CODED = {
  background: '#05070c',
  panel: '#0a0c12',
  banner: 'rgba(10, 12, 18, 0.92)',
  border: '#1d222d',
  text: '#8b93a7',
  muted: '#4d5568',
  ok: '#57d99a',
  fail: '#ff7b72',
} as const;

const declared = declaredRootVariables(html);

describe('index.html declares every Style.ui field as a custom property', () => {
  it('declares exactly the properties applyUiStyle writes (plus the veil)', () => {
    const expected = [...Object.values(UI_CSS_VARIABLES), PANEL_VEIL_VARIABLE].sort();
    const declaredBh = Object.keys(declared)
      .filter((name) => name.startsWith('--bh-'))
      .sort();
    expect(declaredBh).toEqual(expected);
  });

  it("declares the default style's values verbatim", () => {
    for (const [field, variable] of Object.entries(UI_CSS_VARIABLES)) {
      expect(declared[variable], variable).toBe(
        REALISTIC.ui[field as keyof UiStyle],
      );
    }
  });

  it('declares the banner veil as the panel colour at the documented alpha', () => {
    expect(declared[PANEL_VEIL_VARIABLE]).toBe(hexToRgba(REALISTIC.ui.panel, PANEL_VEIL_ALPHA));
    // Byte identity with the pre-style literal the banner used to hard-code.
    expect(declared[PANEL_VEIL_VARIABLE]).toBe(PREVIOUS_HARD_CODED.banner);
  });

  it('consumes every property through var() except the opaque panel base', () => {
    // --bh-panel is the base colour: the banner's visible form is the veil
    // (derived in TS from the same field), and no other surface uses a panel
    // background today. Every other property must actually reach a rule.
    const exceptions = new Set([UI_CSS_VARIABLES.panel]);
    for (const [field, variable] of Object.entries(UI_CSS_VARIABLES)) {
      if (exceptions.has(variable)) continue;
      expect(
        html.match(new RegExp(`var\\(${variable}\\)`)),
        `${field} (${variable}) is declared but never used`,
      ).not.toBeNull();
    }
    expect(html.match(new RegExp(`var\\(${PANEL_VEIL_VARIABLE}\\)`))).not.toBeNull();
  });
});

describe('the default chrome is byte-identical to the previous hard-coded colours', () => {
  it('keeps REALISTIC.ui equal to the literals index.html shipped with', () => {
    expect(REALISTIC.ui).toEqual({
      background: PREVIOUS_HARD_CODED.background,
      panel: PREVIOUS_HARD_CODED.panel,
      border: PREVIOUS_HARD_CODED.border,
      text: PREVIOUS_HARD_CODED.text,
      muted: PREVIOUS_HARD_CODED.muted,
      ok: PREVIOUS_HARD_CODED.ok,
      fail: PREVIOUS_HARD_CODED.fail,
    });
  });

  it('formats the veil exactly like the old rgba() literal', () => {
    expect(hexToRgba(REALISTIC.ui.panel, PANEL_VEIL_ALPHA)).toBe(PREVIOUS_HARD_CODED.banner);
    expect(PANEL_VEIL_ALPHA).toBe(0.92);
  });
});

describe('applyUiStyle writes the active style to the document root', () => {
  function stubRoot(): { root: CssRoot; written: Map<string, string> } {
    const written = new Map<string, string>();
    const root: CssRoot = {
      style: {
        setProperty(name: string, value: string): void {
          written.set(name, value);
        },
      },
    };
    return { root, written };
  }

  it('writes the default style as exactly what index.html already declares', () => {
    // Startup call with the default style must be a visual no-op.
    const { root, written } = stubRoot();
    applyUiStyle(REALISTIC, root);
    expect(written.size).toBe(Object.keys(UI_CSS_VARIABLES).length + 1);
    for (const [field, variable] of Object.entries(UI_CSS_VARIABLES)) {
      expect(written.get(variable), variable).toBe(declared[variable]);
      expect(written.get(variable), variable).toBe(REALISTIC.ui[field as keyof UiStyle]);
    }
    expect(written.get(PANEL_VEIL_VARIABLE)).toBe(declared[PANEL_VEIL_VARIABLE]);
  });

  it('rewrites every property when the retro style is applied', () => {
    const { root, written } = stubRoot();
    applyUiStyle(RETRO, root);
    for (const [field, variable] of Object.entries(UI_CSS_VARIABLES)) {
      expect(written.get(variable), variable).toBe(RETRO.ui[field as keyof UiStyle]);
      expect(written.get(variable), `retro ${field} must differ from the default`).not.toBe(
        REALISTIC.ui[field as keyof UiStyle],
      );
    }
    expect(written.get(PANEL_VEIL_VARIABLE)).toBe('rgba(26, 21, 18, 0.92)');
  });

  it('touches every UiStyle field -- nothing can be silently skipped', () => {
    const { root, written } = stubRoot();
    applyUiStyle(REALISTIC, root);
    const writtenValues = new Set(written.values());
    for (const value of Object.values(REALISTIC.ui)) {
      expect(writtenValues.has(value), value).toBe(true);
    }
  });
});

describe('hexToRgba', () => {
  it('converts #rrggbb + alpha to decimal rgba()', () => {
    expect(hexToRgba('#05070c', 1)).toBe('rgba(5, 7, 12, 1)');
    expect(hexToRgba('#ff7b72', 0.5)).toBe('rgba(255, 123, 114, 0.5)');
  });

  it('keeps single-digit channels un-padded, like the old literal', () => {
    expect(hexToRgba('#0a0c12', 0.92)).toBe('rgba(10, 12, 18, 0.92)');
    expect(hexToRgba('#05070c', 0.92)).toBe('rgba(5, 7, 12, 0.92)');
  });
});
