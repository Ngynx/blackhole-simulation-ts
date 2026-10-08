/**
 * Presentation styles for the black-hole renderer.
 *
 * A `Style` describes HOW the frame looks -- sky gradient, wireframe tint,
 * render resolution, post effects and page chrome colours. It never describes
 * HOW the frame is computed: the RK4 geodesic march, the accretion-disk ramp,
 * the star shading and the Flamm wireframe geometry are shared by every style
 * and must never be parameterised by one. Nothing in this module may be read
 * by physics code; consumers are limited to the sky/post/UI layers.
 *
 * This module is intentionally dependency-free, DOM-free and GPU-free: it is
 * plain data plus a name resolver, so it can be unit-tested without a WebGPU
 * adapter and imported by shader-side uniform builders later.
 */

/** Identifiers of the presentation presets shipped with the app. */
export type StyleName = 'realistic' | 'retro';

/** Colour channels in the 0..1 range, stored as an immutable tuple. */
export type RGB = readonly [number, number, number];

/** Sky presentation: the background gradient and the optional celestial grid. */
export interface SkyStyle {
  readonly low: RGB;                 // gradient bottom (direction y = -1)
  readonly high: RGB;                // gradient top (direction y = +1)
  readonly gridColor: RGB;           // celestial meridian/parallel tint
  readonly gridStrength: number;     // multiplier; 0 disables the sky grid
  readonly proceduralStars: boolean; // hash-based micro stars in the sky
}

/** Flamm-surface wireframe presentation. */
export interface WireStyle {
  readonly color: RGB;   // Flamm wireframe tint
  readonly alpha: number; // 0..1 base opacity
}

/** Post-processing switches applied after the compute pass. */
export interface PostStyle {
  readonly palette: boolean;   // quantise to RETRO_PALETTE
  readonly dither: boolean;    // ordered 4x4 dither before quantising
  readonly scanlines: boolean; // CRT scanline darkening
  readonly vignette: boolean;  // radial darkening at the frame edge
}

/** Page chrome colours, as CSS hex strings. */
export interface UiStyle {
  readonly background: string; // '#rrggbb'
  readonly panel: string;
  readonly border: string;
  readonly text: string;
  readonly muted: string;
  readonly ok: string;
  readonly fail: string;
}

/** A complete presentation preset. Contains no physics parameters. */
export interface Style {
  readonly name: StyleName;
  /** Fraction (0, 1] of the canvas backing store the compute pass renders into. */
  readonly renderScale: number;
  readonly sky: SkyStyle;
  readonly wire: WireStyle;
  readonly post: PostStyle;
  readonly ui: UiStyle;
}

/**
 * The current look of the application, byte-for-byte. This is the default
 * style and the baseline every other preset is compared against.
 */
export const REALISTIC: Style = {
  name: 'realistic',
  renderScale: 1,
  sky: {
    low: [0.010, 0.016, 0.034],
    high: [0.026, 0.040, 0.070],
    gridColor: [0.030, 0.075, 0.120],
    gridStrength: 1,
    proceduralStars: true,
  },
  wire: {
    color: [0.5, 0.5, 0.5],
    alpha: 0.7,
  },
  post: {
    palette: false,
    dither: false,
    scanlines: false,
    vignette: false,
  },
  ui: {
    background: '#05070c',
    panel: '#0a0c12',
    border: '#1d222d',
    text: '#8b93a7',
    muted: '#4d5568',
    ok: '#57d99a',
    fail: '#ff7b72',
  },
};

/**
 * The retro scientific-simulation look: dark charcoal sky, quarter-resolution
 * rendering, a limited orange/red/yellow-orange palette and CRT effects.
 *
 * Invariant: both sky colours must keep a blue channel well above zero. The
 * renderer's shadow detection (gpuRenderer.ts:measureShadowDiameterCanvasPx) reads the
 * compute texture BEFORE any post effect and classifies a texel as shadow with
 * `blue <= 4` out of 255. A retro sky dark enough in blue would be misread as
 * shadow and the measured diameter would blow up to the full frame.
 */
export const RETRO: Style = {
  name: 'retro',
  renderScale: 0.25,
  sky: {
    low: [0.078, 0.067, 0.059],
    high: [0.102, 0.086, 0.075],
    gridColor: [0.30, 0.14, 0.05],
    gridStrength: 0.6,
    proceduralStars: false,
  },
  wire: {
    color: [0.62, 0.40, 0.20],
    alpha: 0.7,
  },
  post: {
    palette: true,
    dither: true,
    scanlines: true,
    vignette: true,
  },
  ui: {
    background: '#120f0d',
    panel: '#1a1512',
    border: '#3a2a1c',
    text: '#d9a066',
    muted: '#8a5f3a',
    ok: '#ff9a3c',
    fail: '#ff5533',
  },
};

/** Every shipped preset, keyed by name. */
export const STYLES: Readonly<Record<StyleName, Style>> = {
  realistic: REALISTIC,
  retro: RETRO,
};

/** Style applied when no valid style name is supplied. */
export const DEFAULT_STYLE: StyleName = 'realistic';

/**
 * The limited-colour ramp used by the retro post pass (palette quantisation).
 * Fixed 12-entry sequence: black/charcoal neutrals followed by the red,
 * orange and yellow-orange families of the retro palette. Order matters --
 * quantisation maps a colour to the nearest entry in this list.
 */
export const RETRO_PALETTE: readonly RGB[] = [
  [0, 0, 0],
  [0.078, 0.067, 0.059],
  [0.13, 0.11, 0.095],
  [0.35, 0.06, 0.04],
  [0.75, 0.14, 0.06],
  [1.0, 0.30, 0.08],
  [1.0, 0.45, 0.10],
  [1.0, 0.60, 0.15],
  [1.0, 0.75, 0.22],
  [1.0, 0.87, 0.35],
  [1.0, 0.95, 0.70],
  [1.0, 0.92, 0.62],
];

/**
 * Resolves a caller-supplied style name to a preset.
 *
 * - `null`/`undefined` resolve to `DEFAULT_STYLE` and are reported as known,
 *   because an absent name means "use the default", not "I made a typo".
 * - An exact `StyleName` resolves to its preset, known.
 * - Any other string falls back to `DEFAULT_STYLE` with `known: false`, so the
 *   caller can surface a warning without crashing.
 */
export function resolveStyle(name: string | null | undefined): {
  style: Style;
  known: boolean;
} {
  if (name === null || name === undefined) {
    return { style: STYLES[DEFAULT_STYLE], known: true };
  }
  if (name === 'realistic' || name === 'retro') {
    return { style: STYLES[name], known: true };
  }
  return { style: STYLES[DEFAULT_STYLE], known: false };
}
