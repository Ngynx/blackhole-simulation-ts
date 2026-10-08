/**
 * Pure selection logic for the presentation style: which style the app starts
 * with (`?style=`) and how the keyboard changes it while it runs (`s`, `c`).
 *
 * Like `style.ts`, this module is dependency-free, DOM-free and GPU-free: it
 * never reads `window.location`, never touches the renderer and never mutates
 * anything, so every branch the UI can take is unit-testable in vitest. The
 * wiring lives elsewhere -- main.ts parses the URL once and passes it in,
 * lensing3d.ts owns the current `Style` and applies each result (renderer
 * uniforms via `setStyle`, page chrome via `applyUiStyle`).
 */

import { REALISTIC, RETRO, resolveStyle, type Style } from './style';

/** Anything with a `get(key)` method: a `URLSearchParams` in the app, a plain
 *  stub in tests. Keeps this module off `window` while staying honest about
 *  what it reads. */
export interface QueryLike {
  get(key: string): string | null;
}

export interface StyleChoice {
  /** Always usable: an unknown or absent name falls back to the default. */
  readonly style: Style;
  /** false only when the URL spelled a name that is not shipped, so the
   *  caller can surface a visible warning without crashing. */
  readonly known: boolean;
}

/**
 * Resolves the `?style=` URL parameter to the style the app starts with.
 *
 * - absent parameter -> default style, `known: true` ("use the default" is
 *   not a typo);
 * - `realistic` / `retro` -> that preset, `known: true`;
 * - anything else -> default style, `known: false` (see `resolveStyle`), so
 *   the caller can warn on screen and still boot.
 */
export function initialStyleFrom(params: QueryLike): StyleChoice {
  const { style, known } = resolveStyle(params.get('style'));
  return { style, known };
}

/**
 * The status note for an unknown `?style=` value, or `''` when none applies.
 *
 * main.ts appends this to the startup status line it passes to `setStatus`,
 * which is how `initialStyleFrom()`'s `known: false` becomes visible on
 * screen. The warning is 3D-only: the 2D canvas draws without style
 * uniforms, so `?style=` is meaningless there -- and so is a warning about
 * one. An invalid value still never crashes, because `initialStyleFrom()`
 * has already fallen back to the default before this is called.
 *
 * Pure like the rest of this module: no DOM, no URL, no renderer.
 */
export function styleWarningNote(mode: string, styleKnown: boolean): string {
  if (mode !== '3d' || styleKnown) return '';
  return ' Unknown style value — falling back to realistic.';
}

/**
 * The `s` key: flips between the two shipped presets and returns the opposite
 * one.
 *
 * Consequence worth knowing: a switch always restores the target preset's own
 * state, so a CRT layer turned off with `c` comes back on when you return to
 * `retro`, and `realistic` comes back with all four post flags off.
 */
export function nextStyle(current: Style): Style {
  return current.name === 'realistic' ? RETRO : REALISTIC;
}

/**
 * The `c` key: toggles the CRT layer -- `scanlines` + `vignette` -- while the
 * retro core (`palette` + `dither`) stays untouched either way, so quantised
 * colour and dithering survive a CRT switch.
 *
 * Deliberate no-op: when the style has neither core flag on (the `realistic`
 * preset ships all four flags off), there is no CRT layer to show, so pressing
 * `c` there returns the SAME object and nothing on screen changes. Toggling
 * the two CRT flags on anyway would paint scanlines over a non-quantised
 * image -- a look no preset asked for. The two CRT flags are always written
 * together, so a mixed state cannot arise from toggling.
 */
export function toggleCrt(style: Style): Style {
  if (!style.post.palette && !style.post.dither) return style;
  const enable = !(style.post.scanlines && style.post.vignette);
  return { ...style, post: { ...style.post, scanlines: enable, vignette: enable } };
}
