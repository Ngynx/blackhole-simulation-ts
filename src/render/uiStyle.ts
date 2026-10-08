/**
 * Applies `Style.ui` to the page chrome through CSS custom properties.
 *
 * `index.html` declares every property once in `:root` with the default
 * style's values (so the pre-JS default load is byte-identical to the old
 * hard-coded colours), and this module rewrites them from the active `Style`
 * on startup and on every switch. `uiStyle.test.ts` parses `index.html` and
 * fails if the declared defaults ever drift from `REALISTIC.ui`, so the two
 * sources cannot disagree.
 *
 * DOM-touching by necessity (it writes custom properties), which is why it is
 * NOT part of `style.ts`: that module stays DOM-free so it can be imported by
 * the uniform builders. Everything here is still unit-testable -- pass your
 * own `root` and no real document is needed.
 */

import type { Style, UiStyle } from './style';

/** The element-like shape `applyUiStyle` needs; `document.documentElement`
 *  satisfies it, and so does a test stub. */
export interface CssRoot {
  style: { setProperty(name: string, value: string): void };
}

/**
 * One CSS custom property per `UiStyle` field. The names are the contract
 * between this module and `index.html`; renaming one without the other breaks
 * `uiStyle.test.ts`, which is exactly the point.
 */
export const UI_CSS_VARIABLES: Readonly<Record<keyof UiStyle, string>> = {
  background: '--bh-background',
  panel: '--bh-panel',
  border: '--bh-border',
  text: '--bh-text',
  muted: '--bh-muted',
  ok: '--bh-ok',
  fail: '--bh-fail',
};

/**
 * Alpha of the status banner's panel background. The banner floats over the
 * canvas, so it uses the panel colour veiled at 92% instead of opaque -- the
 * exact `rgba(10, 12, 18, 0.92)` the stylesheet hard-coded before styles
 * existed. Precomputed into `--bh-panel-veil` (rather than derived in CSS)
 * so the default declaration stays byte-identical to that literal and no
 * browser-dependent colour function is involved.
 */
export const PANEL_VEIL_ALPHA = 0.92;

/** Derived companion of `--bh-panel`; declared in `index.html` next to it. */
export const PANEL_VEIL_VARIABLE = '--bh-panel-veil';

/** `#rrggbb` + alpha -> `rgba(r, g, b, a)` with decimal channels. */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Writes every chrome colour of `style.ui` to the given root (the document
 * root by default): the seven `--bh-*` properties plus `--bh-panel-veil`, the
 * banner's veiled form of `--bh-panel`. Called once at mode startup and again
 * on every style switch; calling it with the default style is a visual no-op
 * because the values equal `index.html`'s `:root` declarations.
 */
export function applyUiStyle(style: Style, root?: CssRoot): void {
  const target = root ?? document.documentElement;
  for (const [field, variable] of Object.entries(UI_CSS_VARIABLES)) {
    target.style.setProperty(variable, style.ui[field as keyof UiStyle]);
  }
  target.style.setProperty(PANEL_VEIL_VARIABLE, hexToRgba(style.ui.panel, PANEL_VEIL_ALPHA));
}
