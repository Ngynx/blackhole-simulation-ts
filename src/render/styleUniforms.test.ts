import { describe, expect, it } from 'vitest';
import { REALISTIC, RETRO, RETRO_PALETTE } from './style';
import type { Style } from './style';
import {
  PALETTE_ENTRIES,
  PALETTE_UNIFORM_FLOATS,
  POST_INV_CANVAS_OFFSET,
  POST_UNIFORM_FLOATS,
  SKY_UNIFORM_FLOATS,
  WIRE_INV_CANVAS_OFFSET,
  WIRE_UNIFORM_FLOATS,
  buildInvCanvasUniform,
  buildPaletteUniform,
  buildPostStyleUniform,
  buildSkyStyleUniform,
  buildWireStyleUniform,
} from './styleUniforms';

const PRESETS: readonly Style[] = [REALISTIC, RETRO];

/**
 * Every buffer is vec4-only, so a legal uniform binding size is a multiple of
 * 16 bytes and no implicit padding can hide between members.
 */
function expectVec4Only(data: Float32Array, floatsPerVec4 = 4): void {
  expect(data.length % floatsPerVec4).toBe(0);
  for (const value of data) {
    expect(Number.isFinite(value)).toBe(true);
  }
}

describe('uniform buffers match the WGSL layout tables', () => {
  it('sizes sky/wire/post at 48/32/32 bytes', () => {
    // Wire and post grew 16 -> 32 bytes in phase 3: each gained an
    // `invCanvas: vec2<f32>` at byte 16 and the uniform struct rounds 24 up
    // to a multiple of 16.
    expect(buildSkyStyleUniform(REALISTIC).byteLength).toBe(48);
    expect(buildWireStyleUniform(REALISTIC).byteLength).toBe(32);
    expect(buildPostStyleUniform(REALISTIC).byteLength).toBe(32);
  });

  it('exports the element counts the renderer sizes buffers from', () => {
    expect(SKY_UNIFORM_FLOATS).toBe(12);
    expect(WIRE_UNIFORM_FLOATS).toBe(8);
    expect(POST_UNIFORM_FLOATS).toBe(8);
    expect(SKY_UNIFORM_FLOATS * 4).toBe(48);
    expect(WIRE_UNIFORM_FLOATS * 4).toBe(32);
    expect(POST_UNIFORM_FLOATS * 4).toBe(32);
  });

  it('exports the invCanvas byte offsets the renderer writes at', () => {
    expect(WIRE_INV_CANVAS_OFFSET).toBe(16);
    expect(POST_INV_CANVAS_OFFSET).toBe(16);
    // The offset must address a float slot inside the buffer.
    expect(WIRE_INV_CANVAS_OFFSET).toBeLessThan(buildWireStyleUniform(REALISTIC).byteLength);
    expect(POST_INV_CANVAS_OFFSET).toBeLessThan(buildPostStyleUniform(REALISTIC).byteLength);
  });

  it('packs only whole vec4 members with finite values', () => {
    for (const preset of PRESETS) {
      expectVec4Only(buildSkyStyleUniform(preset));
      expectVec4Only(buildWireStyleUniform(preset));
      expectVec4Only(buildPostStyleUniform(preset));
    }
  });
});

describe('the realistic sky uniform is a byte-level regression lock', () => {
  // Phase 2 moved the shader's hardcoded literals into this buffer. The
  // values below are what geodesic3d.wgsl used to spell out; a change here
  // means the default frame would no longer render identically. Each number
  // is compared through Math.fround because a WGSL f32 literal and a value
  // stored in a Float32Array round to the SAME f32 from the same decimal.
  const sky = buildSkyStyleUniform(REALISTIC);

  it('places gradient low at byte 0 with the old literal values', () => {
    expect(sky.subarray(0, 3)).toEqual(
      new Float32Array([Math.fround(0.01), Math.fround(0.016), Math.fround(0.034)]),
    );
  });

  it('places grid strength at byte 12, exactly 1 (the old implicit multiplier)', () => {
    expect(sky[3]).toBe(1);
    expect(sky[3]).toBe(REALISTIC.sky.gridStrength);
  });

  it('places gradient high at byte 16 with the old literal values', () => {
    expect(sky.subarray(4, 7)).toEqual(
      new Float32Array([Math.fround(0.026), Math.fround(0.04), Math.fround(0.07)]),
    );
  });

  it('places the procedural-star switch at byte 28 as 1 (the old always-on path)', () => {
    expect(sky[7]).toBe(1);
    expect(sky[7]).toBe(REALISTIC.sky.proceduralStars ? 1 : 0);
  });

  it('places grid tint at byte 32 with the old literal values', () => {
    expect(sky.subarray(8, 11)).toEqual(
      new Float32Array([Math.fround(0.03), Math.fround(0.075), Math.fround(0.12)]),
    );
  });

  it('leaves the reserved w component of the tint at 0', () => {
    expect(sky[11]).toBe(0);
  });

  it('reads every value straight from REALISTIC, not from copied literals', () => {
    expect(Array.from(sky.subarray(0, 3))).toEqual(Array.from(REALISTIC.sky.low, Math.fround));
    expect(sky[3]).toBe(Math.fround(REALISTIC.sky.gridStrength));
    expect(Array.from(sky.subarray(4, 7))).toEqual(Array.from(REALISTIC.sky.high, Math.fround));
    expect(Array.from(sky.subarray(8, 11))).toEqual(
      Array.from(REALISTIC.sky.gridColor, Math.fround),
    );
  });
});

describe('the sky uniform carries the full preset for any style', () => {
  it('maps every RETRO sky field to its documented slot', () => {
    const sky = buildSkyStyleUniform(RETRO);
    expect(Array.from(sky.subarray(0, 3))).toEqual(Array.from(RETRO.sky.low, Math.fround));
    expect(sky[3]).toBe(Math.fround(RETRO.sky.gridStrength));
    expect(Array.from(sky.subarray(4, 7))).toEqual(Array.from(RETRO.sky.high, Math.fround));
    expect(sky[7]).toBe(0); // RETRO has no procedural stars
    expect(Array.from(sky.subarray(8, 11))).toEqual(Array.from(RETRO.sky.gridColor, Math.fround));
    expect(sky[11]).toBe(0);
  });

  it('encodes gridStrength 0 as 0 so a style can disable the grid', () => {
    const noGrid: Style = {
      ...REALISTIC,
      sky: { ...REALISTIC.sky, gridStrength: 0 },
    };
    expect(buildSkyStyleUniform(noGrid)[3]).toBe(0);
  });

  it('accepts a style that only overrides the star switch', () => {
    const noStars: Style = {
      ...REALISTIC,
      sky: { ...REALISTIC.sky, proceduralStars: false },
    };
    const sky = buildSkyStyleUniform(noStars);
    expect(sky[7]).toBe(0);
    // Everything else still mirrors the base preset.
    expect(sky.subarray(0, 3)).toEqual(buildSkyStyleUniform(REALISTIC).subarray(0, 3));
  });
});

describe('the wireframe uniform carries tint and alpha', () => {
  it('locks the realistic wireframe to (0.5, 0.5, 0.5) at 0.7', () => {
    // grid.frag's vec4(0.5, 0.5, 0.5, 0.7), which grid.wgsl used verbatim.
    // 0.5 is exact in f32; 0.7 must be compared against its f32 rounding.
    // Floats 4..7 are the phase-3 tail: invCanvas (zeros until the renderer
    // writes 1 / canvas size at WIRE_INV_CANVAS_OFFSET) plus its padding.
    const wire = buildWireStyleUniform(REALISTIC);
    expect(Array.from(wire)).toEqual([0.5, 0.5, 0.5, Math.fround(0.7), 0, 0, 0, 0]);
  });

  it('maps every RETRO wire field to its documented slot', () => {
    const wire = buildWireStyleUniform(RETRO);
    expect(Array.from(wire.subarray(0, 3))).toEqual(Array.from(RETRO.wire.color, Math.fround));
    expect(wire[3]).toBe(Math.fround(RETRO.wire.alpha));
    expect(Array.from(wire.subarray(4))).toEqual([0, 0, 0, 0]);
  });
});

describe('the post-flags uniform encodes booleans as 0/1', () => {
  it('sends every flag as 0 for the default style', () => {
    // 8 floats: four flags, then invCanvas + padding (zeros until resize).
    expect(Array.from(buildPostStyleUniform(REALISTIC))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('sends every flag as 1 for the retro style', () => {
    expect(Array.from(buildPostStyleUniform(RETRO))).toEqual([1, 1, 1, 1, 0, 0, 0, 0]);
  });

  it('places each flag at its documented byte offset', () => {
    const mixed: Style = {
      ...REALISTIC,
      post: { palette: true, dither: false, scanlines: true, vignette: false },
    };
    const data = buildPostStyleUniform(mixed);
    expect(Array.from(data)).toEqual([1, 0, 1, 0, 0, 0, 0, 0]);
    // Little-endian f32: 1.0 is 0x3F800000 -> bytes 00 00 80 3F. Checking the
    // raw slots proves both the offsets and the byte order the WGSL uniform
    // address space expects.
    const bytes = new Uint8Array(data.buffer);
    const ONE = [0x00, 0x00, 0x80, 0x3f];
    const ZERO = [0x00, 0x00, 0x00, 0x00];
    expect(Array.from(bytes.subarray(0, 4))).toEqual(ONE); //  offset 0  palette
    expect(Array.from(bytes.subarray(4, 8))).toEqual(ZERO); // offset 4  dither
    expect(Array.from(bytes.subarray(8, 12))).toEqual(ONE); //  offset 8  scanlines
    expect(Array.from(bytes.subarray(12, 16))).toEqual(ZERO); // offset 12 vignette
    // Phase 3: invCanvas sits at byte 16 and starts as zero.
    expect(Array.from(bytes.subarray(16, 24))).toEqual([...ZERO, ...ZERO]);
  });
});

describe('the palette uniform is exactly the RETRO_PALETTE ramp', () => {
  // Phase 4 uploads the ramp as blit binding 3 (array<vec4<f32>, 12>).
  // style.ts is the ONLY place the colours are spelled out: every assertion
  // below reads RETRO_PALETTE, never a re-typed literal, so a ramp edit
  // cannot desynchronise shader, buffer and tests.
  const palette = buildPaletteUniform(RETRO_PALETTE);

  it('is 192 bytes: 12 vec4 entries, count mirroring RETRO_PALETTE', () => {
    expect(PALETTE_ENTRIES).toBe(RETRO_PALETTE.length);
    expect(PALETTE_UNIFORM_FLOATS).toBe(RETRO_PALETTE.length * 4);
    expect(palette.length).toBe(PALETTE_UNIFORM_FLOATS);
    expect(palette.byteLength).toBe(RETRO_PALETTE.length * 16);
    expect(palette.byteLength).toBe(192);
  });

  it('maps every RETRO_PALETTE entry through the same f32 conversion, at stride 16', () => {
    RETRO_PALETTE.forEach((rgb, i) => {
      // Float32Array.set rounds each channel to f32 exactly like Math.fround
      // -- both are IEEE round-to-nearest-even from the same decimal.
      expect(Array.from(palette.subarray(i * 4, i * 4 + 3)), `entry ${i}`).toEqual(
        Array.from(rgb, Math.fround),
      );
      // Alpha is a filler the shader ignores; it must still be defined.
      expect(palette[i * 4 + 3], `entry ${i} alpha`).toBe(1);
    });
  });

  it('rejects a ramp whose length differs from the fixed WGSL array', () => {
    // The shader declares array<vec4<f32>, 12> with no runtime sizing, so a
    // wrong-length ramp would only fail later as a WebGPU validation error.
    expect(() => buildPaletteUniform(RETRO_PALETTE.slice(0, PALETTE_ENTRIES - 1))).toThrow(
      /must hold 12 entries, got 11/,
    );
    expect(() => buildPaletteUniform([])).toThrow(/must hold 12 entries, got 0/);
  });

  it('returns a fresh array and never mutates the ramp', () => {
    const snapshot = JSON.stringify(RETRO_PALETTE);
    const first = buildPaletteUniform(RETRO_PALETTE);
    const second = buildPaletteUniform(RETRO_PALETTE);
    expect(first).not.toBe(second);
    first[0] = 123;
    expect(JSON.stringify(RETRO_PALETTE)).toBe(snapshot);
    expect(buildPaletteUniform(RETRO_PALETTE)[0]).toBe(0);
  });
});

describe('the invCanvas builder feeds the renderer writes', () => {
  it('returns the two reciprocals the shaders multiply by', () => {
    // Float32Array storage: the reciprocals land on f32 precision, which is
    // what the shader actually multiplies by.
    expect(Array.from(buildInvCanvasUniform(1920, 1080))).toEqual([
      Math.fround(1 / 1920),
      Math.fround(1 / 1080),
    ]);
    expect(Array.from(buildInvCanvasUniform(1, 1))).toEqual([1, 1]);
  });

  it('returns a vec2 sized for the byte-16 slot of both structs', () => {
    const inv = buildInvCanvasUniform(800, 600);
    expect(inv.length).toBe(2);
    expect(inv.byteLength).toBe(8);
    // writeBuffer targets byte offsets, so the vec2 must fit behind the
    // struct sizes the builders produce.
    expect(WIRE_INV_CANVAS_OFFSET + inv.byteLength).toBeLessThanOrEqual(
      buildWireStyleUniform(REALISTIC).byteLength,
    );
    expect(POST_INV_CANVAS_OFFSET + inv.byteLength).toBeLessThanOrEqual(
      buildPostStyleUniform(REALISTIC).byteLength,
    );
  });

  it('shrinks as the canvas grows, which is what "uv * invCanvas" needs', () => {
    const small = buildInvCanvasUniform(100, 100);
    const large = buildInvCanvasUniform(400, 100);
    expect(small[0]).toBeGreaterThan(large[0]);
    expect(small[1]).toBe(large[1]);
  });
});

describe('builders are pure', () => {
  it('returns a fresh array on every call', () => {
    const first = buildSkyStyleUniform(REALISTIC);
    const second = buildSkyStyleUniform(REALISTIC);
    expect(first).not.toBe(second);
    first[0] = 123;
    expect(second[0]).toBe(buildSkyStyleUniform(REALISTIC)[0]);
  });

  it('never mutates the style it was given', () => {
    const snapshot = JSON.stringify(REALISTIC);
    buildSkyStyleUniform(REALISTIC);
    buildWireStyleUniform(REALISTIC);
    buildPostStyleUniform(REALISTIC);
    expect(JSON.stringify(REALISTIC)).toBe(snapshot);
  });
});
