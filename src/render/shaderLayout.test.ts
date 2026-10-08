/**
 * Layout parity between the WGSL uniform structs and the TypeScript side.
 *
 * The three shaders declare uniform structs by hand and the builders in
 * styleUniforms.ts mirror them by hand -- two sources of truth that can drift
 * silently (WebGPU validates sizes only when a bind group is created, i.e.
 * never in vitest). This test parses the real shader sources (imported with
 * the same `?raw` suffix the renderer uses), computes every uniform struct's
 * member offsets and byte size under the WGSL uniform-address-space rules,
 * and asserts the results equal the TS constants and builder byte lengths.
 *
 * Rules implemented (WGSL spec, "Address Space Layout Constraints"):
 *   - RequiredAlignOf(T, uniform): f32/i32/u32 = 4, vec2 = 8, vec4 = 16,
 *     mat4x4 = 16; struct and array members = roundUp(16, AlignOf).
 *   - A member's offset is a multiple of its RequiredAlignOf.
 *   - SizeOf(struct) = roundUp(AlignOf(struct), end of last member), and
 *     AlignOf(struct) = max alignment over its members.
 *   - Array element stride in uniform space is a multiple of 16.
 * Every struct in this project lands on 16-byte member boundaries anyway,
 * so the offsets would be identical under the plain-storage rules too.
 */
import { describe, expect, it } from 'vitest';
import blitSource from '../shaders/blit.wgsl?raw';
import geodesicSource from '../shaders/geodesic3d.wgsl?raw';
import gridSource from '../shaders/grid.wgsl?raw';
import { STARS, STAR_FLOATS } from '../physics/stars';
import { CAMERA_FLOATS } from './gpuRenderer';
import rendererSource from './gpuRenderer.ts?raw';
import { REALISTIC, RETRO_PALETTE } from './style';
import { buildWireStyleUniform, buildPostStyleUniform, buildPaletteUniform,
  buildSkyStyleUniform, PALETTE_ENTRIES, PALETTE_UNIFORM_FLOATS,
  POST_INV_CANVAS_OFFSET, POST_UNIFORM_FLOATS, SKY_UNIFORM_FLOATS,
  WIRE_INV_CANVAS_OFFSET, WIRE_UNIFORM_FLOATS } from './styleUniforms';
import { VIEW_PROJECTION_FLOATS } from './viewProjection';

// --- Parser ---------------------------------------------------------------

interface Member {
  readonly name: string;
  readonly type: string;
}

interface UniformVar {
  readonly name: string;
  readonly binding: number;
  readonly group: number;
  /** Raw declared type, e.g. `Camera` or `array<Star, STAR_COUNT>`. */
  readonly type: string;
  readonly isUniform: boolean;
}

/** Drops line and block comments so prose cannot be parsed as a declaration. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Splits struct bodies on top-level commas, keeping `array<A, B>` intact. */
function splitMembers(body: string): string[] {
  const chunks: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of body) {
    if (ch === '<') depth += 1;
    if (ch === '>') depth -= 1;
    if (ch === ',' && depth === 0) {
      chunks.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

/** Parses every `struct Name { members }` declaration in a shader. */
function parseStructs(source: string): Map<string, Member[]> {
  const table = new Map<string, Member[]>();
  const pattern = /struct\s+([A-Za-z_]\w*)\s*\{([^{}]*)\}/g;
  for (const match of stripComments(source).matchAll(pattern)) {
    const name = match[1];
    const members: Member[] = [];
    for (const chunk of splitMembers(match[2])) {
      // Strip @builtin(...) / @location(...) attributes before splitting.
      const decl = chunk
        .replace(/@[A-Za-z_]\w*(\([^)]*\))?/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!decl) continue;
      const parsed = /^([A-Za-z_]\w*)\s*:\s*(.+)$/.exec(decl);
      if (!parsed) throw new Error(`cannot parse member "${decl}" of struct ${name}`);
      members.push({ name: parsed[1], type: parsed[2].trim() });
    }
    table.set(name, members);
  }
  return table;
}

/** Parses every `@group(g) @binding(b) var... name: Type;` declaration. */
function parseResourceVars(source: string): UniformVar[] {
  const vars: UniformVar[] = [];
  const pattern =
    /@group\(\s*(\d+)\s*\)\s*@binding\(\s*(\d+)\s*\)\s*var\s*(<[^>]*>)?\s*([A-Za-z_]\w*)\s*:\s*([^;]+);/g;
  for (const match of stripComments(source).matchAll(pattern)) {
    vars.push({
      group: Number(match[1]),
      binding: Number(match[2]),
      isUniform: match[3] === '<uniform>',
      name: match[4],
      type: match[5].trim(),
    });
  }
  return vars;
}

/** Element type of `array<T, N>` or the type itself. */
function baseType(type: string): string {
  const array = /^array<([^,>]+)/.exec(type.trim());
  return array ? array[1].trim() : type.trim();
}

interface Layout {
  readonly size: number;
  readonly align: number;
}

function roundUp(alignment: number, value: number): number {
  return Math.ceil(value / alignment) * alignment;
}

/** Layout of one type in the UNIFORM address space. */
function typeLayout(type: string, table: Map<string, Member[]>, memo: Map<string, Layout>): Layout {
  const t = type.trim();
  if (t === 'f32' || t === 'i32' || t === 'u32') return { size: 4, align: 4 };
  const vec = /^vec([234])<f32>$/.exec(t);
  if (vec) {
    const components = Number(vec[1]);
    return { size: 4 * components, align: components === 3 ? 16 : 4 * components };
  }
  if (t === 'mat4x4<f32>') return { size: 64, align: 16 };
  // array<E, N> (PaletteRamp in blit.wgsl): uniform address space rounds the
  // element stride up to a multiple of 16, and AlignOf(array) = AlignOf(E) --
  // the member's RequiredAlignOf adds the outer roundUp(16, ...) in
  // structLayout()/memberOffsets() below.
  if (t.startsWith('array<')) {
    const array = /^array<(.+),\s*(\d+)>$/.exec(t);
    if (!array) throw new Error(`cannot parse array type: ${t}`);
    const element = typeLayout(array[1], table, memo);
    const stride = roundUp(16, element.size);
    return { size: Number(array[2]) * stride, align: element.align };
  }
  if (table.has(t)) return structLayout(t, table, memo);
  throw new Error(`unsupported type in a uniform declaration: ${t}`);
}

/** Offsets + size of a struct under uniform-address-space rules. */
function structLayout(
  name: string,
  table: Map<string, Member[]>,
  memo: Map<string, Layout>,
): Layout {
  const cached = memo.get(name);
  if (cached) return cached;
  const members = table.get(name);
  if (!members) throw new Error(`struct ${name} is not declared in this shader`);

  let cursor = 0;
  let align = 1;
  for (const member of members) {
    const layout = typeLayout(member.type, table, memo);
    const nested = table.has(member.type.trim()) || member.type.trim().startsWith('array<');
    // RequiredAlignOf(T, uniform): plain align for scalars/vectors/matrices,
    // roundUp(16, align) for struct and array members.
    const required = nested ? roundUp(16, layout.align) : layout.align;
    cursor = roundUp(required, cursor) + layout.size;
    align = Math.max(align, layout.align);
  }
  // SizeOf(S) = roundUp(AlignOf(S), end of last member) -- this is what
  // makes vec4 + vec2 a 32-byte uniform struct, not 24.
  const layout: Layout = { size: roundUp(align, cursor), align };
  memo.set(name, layout);
  return layout;
}

function memberOffsets(
  name: string,
  table: Map<string, Member[]>,
  memo: Map<string, Layout>,
): number[] {
  const members = table.get(name);
  if (!members) throw new Error(`struct ${name} is not declared in this shader`);
  let cursor = 0;
  return members.map((member) => {
    const layout = typeLayout(member.type, table, memo);
    const nested = table.has(member.type.trim()) || member.type.trim().startsWith('array<');
    const required = nested ? roundUp(16, layout.align) : layout.align;
    cursor = roundUp(required, cursor);
    const offset = cursor;
    cursor += layout.size;
    return offset;
  });
}

// --- Expected table (the second source of truth, kept honest by parsing) ---

const SHADERS: Record<string, string> = {
  'geodesic3d.wgsl': geodesicSource,
  'grid.wgsl': gridSource,
  'blit.wgsl': blitSource,
};

/** variable name -> binding index, per shader. Locks phase-2 indices too. */
const EXPECTED_BINDINGS: Record<string, Record<string, number>> = {
  'geodesic3d.wgsl': { cam: 0, outputTex: 1, objects: 2, skyStyle: 3 },
  'grid.wgsl': { params: 0, source: 1, wireStyle: 2, sourceSampler: 3 },
  'blit.wgsl': { source: 0, postFlags: 1, sourceSampler: 2, paletteRamp: 3 },
};

/** Declared types of every `var<uniform>`, in source order. */
const EXPECTED_UNIFORMS: Record<string, string[]> = {
  'geodesic3d.wgsl': ['Camera', 'array<Star, STAR_COUNT>', 'SkyStyleUniform'],
  'grid.wgsl': ['Params', 'WireStyleUniform'],
  'blit.wgsl': ['PostStyleFlags', 'PaletteRamp'],
};

/** Member names + types in declaration order, for every uniform struct. */
const EXPECTED_MEMBERS: Record<string, Member[]> = {
  Camera: [
    { name: 'posTan', type: 'vec4<f32>' },
    { name: 'rightAspect', type: 'vec4<f32>' },
    { name: 'up', type: 'vec4<f32>' },
    { name: 'fwd', type: 'vec4<f32>' },
  ],
  Star: [
    { name: 'posRadius', type: 'vec4<f32>' },
    { name: 'color', type: 'vec4<f32>' },
  ],
  SkyStyleUniform: [
    { name: 'lowGrid', type: 'vec4<f32>' },
    { name: 'highStars', type: 'vec4<f32>' },
    { name: 'gridTint', type: 'vec4<f32>' },
  ],
  Params: [{ name: 'viewProj', type: 'mat4x4<f32>' }],
  WireStyleUniform: [
    { name: 'colorAlpha', type: 'vec4<f32>' },
    { name: 'invCanvas', type: 'vec2<f32>' },
  ],
  PostStyleFlags: [
    { name: 'flags', type: 'vec4<f32>' },
    { name: 'invCanvas', type: 'vec2<f32>' },
  ],
  PaletteRamp: [{ name: 'entries', type: 'array<vec4<f32>, 12>' }],
};

/** Byte offset of each member, in declaration order. */
const EXPECTED_OFFSETS: Record<string, number[]> = {
  Camera: [0, 16, 32, 48],
  Star: [0, 16],
  SkyStyleUniform: [0, 16, 32],
  Params: [0],
  WireStyleUniform: [0, 16],
  PostStyleFlags: [0, 16],
  PaletteRamp: [0],
};

/** Byte sizes, tied to the TS constant that sizes the GPU buffer. */
const EXPECTED_SIZES: Record<string, number> = {
  Camera: CAMERA_FLOATS * 4,
  Star: STAR_FLOATS * 4,
  SkyStyleUniform: SKY_UNIFORM_FLOATS * 4,
  Params: VIEW_PROJECTION_FLOATS * 4,
  WireStyleUniform: WIRE_UNIFORM_FLOATS * 4,
  PostStyleFlags: POST_UNIFORM_FLOATS * 4,
  PaletteRamp: PALETTE_UNIFORM_FLOATS * 4,
};

// --- The parsed truth, computed once ---------------------------------------

const parsedStructs = new Map<string, Map<string, Member[]>>();
const parsedVars = new Map<string, UniformVar[]>();
for (const [file, source] of Object.entries(SHADERS)) {
  parsedStructs.set(file, parseStructs(source));
  parsedVars.set(file, parseResourceVars(source));
}

/** Structs reachable from any `var<uniform>` declaration, across files. */
const uniformStructNames = new Set<string>();
const uniformTypesByFile: Record<string, string[]> = {};
for (const [file, vars] of parsedVars) {
  const uniformTypes = vars.filter((v) => v.isUniform).map((v) => v.type);
  uniformTypesByFile[file] = uniformTypes;
  for (const type of uniformTypes) {
    uniformStructNames.add(baseType(type));
  }
}
const allStructs = new Map<string, Member[]>();
for (const table of parsedStructs.values()) {
  for (const [name, members] of table) allStructs.set(name, members);
}

// Follow member types so nested structs (e.g. `Star` inside `array<Star, N>`)
// are laid out too: fixpoint over {structs referenced by uniform declarations}
// x {structs referenced by their members}.
let grew = true;
while (grew) {
  grew = false;
  for (const name of [...uniformStructNames]) {
    for (const member of allStructs.get(name) ?? []) {
      const nested = baseType(member.type);
      if (allStructs.has(nested) && !uniformStructNames.has(nested)) {
        uniformStructNames.add(nested);
        grew = true;
      }
    }
  }
}

const layoutMemo = new Map<string, Layout>();

// --- Tests -----------------------------------------------------------------

describe('WGSL resource bindings match the renderer bind groups', () => {
  for (const [file, expected] of Object.entries(EXPECTED_BINDINGS)) {
    it(`${file} declares exactly the bindings the renderer fills`, () => {
      const vars = parsedVars.get(file) as UniformVar[];
      const actual: Record<string, number> = {};
      for (const v of vars) {
        expect(v.group).toBe(0);
        actual[v.name] = v.binding;
      }
      expect(actual).toEqual(expected);
    });
  }

  it('grid and blit sample the source through a sampler binding', () => {
    const gridVars = parsedVars.get('grid.wgsl') as UniformVar[];
    const blitVars = parsedVars.get('blit.wgsl') as UniformVar[];
    expect(gridVars.find((v) => v.name === 'sourceSampler')?.type).toBe('sampler');
    expect(blitVars.find((v) => v.name === 'sourceSampler')?.type).toBe('sampler');
  });
});

describe('parsed uniform declarations match the expected table', () => {
  for (const [file, expected] of Object.entries(EXPECTED_UNIFORMS)) {
    it(`${file} declares the expected var<uniform> types in order`, () => {
      expect(uniformTypesByFile[file]).toEqual(expected);
    });
  }

  it('every uniform struct has its members pinned by name, type and order', () => {
    expect([...uniformStructNames].sort()).toEqual(Object.keys(EXPECTED_MEMBERS).sort());
    for (const [name, expected] of Object.entries(EXPECTED_MEMBERS)) {
      const declared = [...parsedStructs.values()]
        .map((table) => table.get(name))
        .find((members) => members !== undefined);
      expect(declared, `struct ${name} not found in any shader`).toEqual(expected);
    }
  });
});

describe('uniform layout rules reproduce the documented offsets', () => {
  it('computes the documented byte offset for every member', () => {
    for (const [name, expected] of Object.entries(EXPECTED_OFFSETS)) {
      expect(memberOffsets(name, allStructs, layoutMemo), name).toEqual(expected);
    }
  });

  it('places invCanvas where the TS writers put it', () => {
    const wire = memberOffsets('WireStyleUniform', allStructs, layoutMemo);
    const post = memberOffsets('PostStyleFlags', allStructs, layoutMemo);
    expect(wire[1]).toBe(WIRE_INV_CANVAS_OFFSET);
    expect(post[1]).toBe(POST_INV_CANVAS_OFFSET);
    expect(WIRE_INV_CANVAS_OFFSET).toBe(16);
    expect(POST_INV_CANVAS_OFFSET).toBe(16);
  });

  it('puts every uniform member on a 16-byte boundary', () => {
    // Not required by the rules for scalars/vec2, but every struct in this
    // project lands there anyway -- a violation would be the first sign of a
    // member creeping into a packed region.
    for (const name of Object.keys(EXPECTED_MEMBERS)) {
      for (const offset of memberOffsets(name, allStructs, layoutMemo)) {
        expect(offset % 16, `${name} member at byte ${offset}`).toBe(0);
      }
    }
  });
});

describe('uniform struct sizes equal the TS buffer sizes', () => {
  it('matches every struct against the constant that sizes its buffer', () => {
    for (const [name, expected] of Object.entries(EXPECTED_SIZES)) {
      const layout = structLayout(name, allStructs, layoutMemo);
      expect(layout.size, name).toBe(expected);
    }
  });

  it('matches the style structs against the bytes their builders return', () => {
    expect(structLayout('SkyStyleUniform', allStructs, layoutMemo).size).toBe(
      buildSkyStyleUniform(REALISTIC).byteLength,
    );
    expect(structLayout('WireStyleUniform', allStructs, layoutMemo).size).toBe(
      buildWireStyleUniform(REALISTIC).byteLength,
    );
    expect(structLayout('PostStyleFlags', allStructs, layoutMemo).size).toBe(
      buildPostStyleUniform(REALISTIC).byteLength,
    );
    expect(structLayout('PaletteRamp', allStructs, layoutMemo).size).toBe(
      buildPaletteUniform(RETRO_PALETTE).byteLength,
    );
  });

  it('sizes the palette ramp from RETRO_PALETTE, the single source of truth', () => {
    // The only place the WGSL array size (12) meets style.ts: struct size
    // comes from the parsed `array<vec4<f32>, 12>`, the expected size from
    // RETRO_PALETTE.length * 16 -- and the loop bound in blit.wgsl must
    // state the same count.
    expect(structLayout('PaletteRamp', allStructs, layoutMemo).size).toBe(
      RETRO_PALETTE.length * 16,
    );
    const loopBound = /const\s+PALETTE_SIZE\s*:\s*u32\s*=\s*(\d+)u\s*;/.exec(
      stripComments(blitSource),
    );
    expect(loopBound, 'PALETTE_SIZE not found in blit.wgsl').not.toBeNull();
    expect(Number(loopBound?.[1])).toBe(PALETTE_ENTRIES);
    expect(Number(loopBound?.[1])).toBe(RETRO_PALETTE.length);
  });

  it('matches the stars uniform array against packStars() stride and count', () => {
    const starCount = /const\s+STAR_COUNT\s*:\s*i32\s*=\s*(\d+)\s*;/.exec(
      stripComments(geodesicSource),
    );
    expect(starCount, 'STAR_COUNT not found in geodesic3d.wgsl').not.toBeNull();
    expect(Number(starCount?.[1])).toBe(STARS.length);
    const stride = structLayout('Star', allStructs, layoutMemo).size;
    expect(stride).toBe(STAR_FLOATS * 4);
    // The objects buffer is created as STARS.length * STAR_FLOATS * 4.
    expect(stride * Number(starCount?.[1])).toBe(STARS.length * STAR_FLOATS * 4);
  });
});

/** Code-only view of gpuRenderer.ts: prose must not satisfy or break assertions. */
const rendererCode = rendererSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

describe('gpuRenderer creates the buffers from those same constants', () => {
  it('sizes every uniform buffer from a layout constant, not a literal', () => {
    expect(rendererCode).toMatch(/size:\s*CAMERA_FLOATS\s*\*\s*4/);
    expect(rendererCode).toMatch(/size:\s*SKY_UNIFORM_FLOATS\s*\*\s*4/);
    expect(rendererCode).toMatch(/size:\s*WIRE_UNIFORM_FLOATS\s*\*\s*4/);
    expect(rendererCode).toMatch(/size:\s*POST_UNIFORM_FLOATS\s*\*\s*4/);
    expect(rendererCode).toMatch(/size:\s*VIEW_PROJECTION_FLOATS\s*\*\s*4/);
    expect(rendererCode).toMatch(/size:\s*STARS\.length\s*\*\s*STAR_FLOATS\s*\*\s*4/);
  });

  it('creates, writes, binds and destroys the palette uniform alongside them', () => {
    // Phase 4's only renderer change: a fourth style buffer (192 bytes from
    // PALETTE_UNIFORM_FLOATS), uploaded once from style.ts, bound as blit
    // binding 3 so `layout:'auto'` can resolve paletteRamp, and released
    // with the rest in destroy().
    expect(rendererCode).toMatch(/size:\s*PALETTE_UNIFORM_FLOATS\s*\*\s*4/);
    expect(rendererCode).toMatch(
      /writeBuffer\(\s*paletteStyleBuffer,\s*0,\s*buildPaletteUniform\(RETRO_PALETTE\)\)/,
    );
    expect(rendererCode).toMatch(
      /\{\s*binding:\s*3,\s*resource:\s*\{\s*buffer:\s*paletteStyleBuffer\s*\}\s*\}/,
    );
    expect(rendererCode).toMatch(/paletteStyleBuffer\.destroy\(\)/);
  });

  it('writes invCanvas at the offsets the shader layout documents', () => {
    expect(rendererCode).toMatch(
      /writeBuffer\(\s*wireStyleBuffer,\s*WIRE_INV_CANVAS_OFFSET/,
    );
    expect(rendererCode).toMatch(
      /writeBuffer\(\s*postStyleBuffer,\s*POST_INV_CANVAS_OFFSET/,
    );
  });

  it('keeps the shadow-measurement read on the blue <= 4 threshold', () => {
    // Hard invariant: measureShadowDiameterCanvasPx classifies a pre-post
    // compute texel as shadow with blue <= 4/255. Changing that number changes
    // the self-check's verdict on every frame.
    expect(rendererCode).toMatch(/bytes\[i \+ 2\]\s*<=\s*4/);
    expect(rendererCode).toMatch(/copyTextureToBuffer\(\s*\{\s*texture\s*\}/);
  });

  it('returns the shadow run in canvas pixels, converted at the API boundary', () => {
    // The count inside measureShadowDiameterCanvasPx is in storage texels,
    // which diverge from canvas pixels below renderScale 1 (4x at 0.25). The
    // conversion must happen before the value leaves the renderer, and the
    // unit must stay in the name so callers cannot use it unconverted.
    expect(rendererCode).toMatch(/measureShadowDiameterCanvasPx\(/);
    expect(rendererCode).not.toMatch(/measureShadowDiameter\(/);
    expect(rendererCode).toMatch(
      /texelsToCanvasPixels\(\s*right - left \+ 1,\s*width,\s*canvasWidth\s*\)/,
    );
  });

  it('applies the style it is handed and never selects one itself', () => {
    // Phase 5 relaxation of the old "selects no style at runtime" guard: the
    // renderer now APPLIES a runtime style through setStyle(), but selection
    // still lives outside it -- main.ts resolves ?style= and lensing3d.ts
    // handles the s/c keys, both through styleSelect.ts. What must never
    // reach this file: the URL, the name resolver, and the named presets
    // (STYLES / RETRO), i.e. the renderer stays preset-agnostic and unit
    // tests can keep calling it with any Style. RETRO_PALETTE is the shared
    // colour ramp, not a preset, and is deliberately allowed.
    expect(rendererCode).toMatch(/setStyle\(\s*style:\s*Style\s*\)/);
    expect(rendererCode).not.toMatch(/resolveStyle|URLSearchParams|location\.search/);
    expect(rendererCode).not.toMatch(/\bRETRO\b/);
    expect(rendererCode).not.toMatch(/\bSTYLES\b/);
  });
});

// --- setStyle() ordering, retarget keying and palette exclusions (phase 5) --
// Three properties of setStyle()/ensureTargets() only ever failed in a
// browser round-trip, because vitest never runs the renderer. They are pinned
// here on the comment-stripped source, same approach as above: brace-extract
// the function body, then order/comparison assertions on that body alone.

/** Body of `marker` plus its braced block, from comment-stripped TS source. */
function tsBody(source: string, marker: string): string {
  const head = source.indexOf(marker);
  expect(head, `marker "${marker}" not found`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', head);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces after "${marker}"`);
}

describe('setStyle writes in the order that keeps invCanvas valid', () => {
  const body = tsBody(rendererCode, 'setStyle(next: Style)');

  it('runs retarget -> style writes -> invCanvas writes, in that order', () => {
    // M12 guard: buildWireStyleUniform()/buildPostStyleUniform() ZERO the
    // invCanvas slot, and ensureTargets() is what makes canvasWidth/Height
    // valid for the canvas write. Writing invCanvas before either of those
    // leaves the wrong bytes on screen until the next full retarget -- a
    // browser-only symptom, so the order is pinned here.
    const marks = [
      'renderScale = next.renderScale',
      'ensureTargets()',
      'writeBuffer(skyStyleBuffer, 0,',
      'writeBuffer(wireStyleBuffer, 0,',
      'writeBuffer(postStyleBuffer, 0,',
      'writeBuffer(wireStyleBuffer, WIRE_INV_CANVAS_OFFSET',
      'writeBuffer(postStyleBuffer, POST_INV_CANVAS_OFFSET',
    ].map((mark) => {
      const at = body.indexOf(mark);
      expect(at, `setStyle is missing "${mark}"`).toBeGreaterThanOrEqual(0);
      return at;
    });
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i], `setStyle step ${i} out of order`).toBeGreaterThan(marks[i - 1]);
    }
  });

  it('assigns the new renderScale before retargeting, never after', () => {
    // ensureTargets() keys on the CURRENT renderScale, so assigning it later
    // would retarget with the outgoing scale and only fix up a frame late.
    const assignment = body.indexOf('renderScale = next.renderScale');
    const retarget = body.indexOf('ensureTargets()');
    expect(assignment).toBeGreaterThanOrEqual(0);
    expect(retarget).toBeGreaterThan(assignment);
    expect(body.indexOf('renderScale = next.renderScale', assignment + 1)).toBe(-1);
  });

  it('never writes the palette buffer', () => {
    // M14 guard: the palette ramp is shared by every preset and uploaded once
    // at construction, so setStyle() rewriting it would couple style switches
    // to a buffer that carries no per-style data.
    expect(body).not.toMatch(/paletteStyleBuffer/);
  });
});

describe('ensureTargets keys its early return on the renderScale target size', () => {
  const body = tsBody(rendererCode, 'function ensureTargets');

  it('derives the compared size from scaledTargetSize(..., renderScale)', () => {
    // M13 guard: if the early-return key ignored renderScale, a style switch
    // that only changes the scale (retro <-> realistic on the same canvas)
    // would keep the old-size texture and render into a stale target.
    expect(body).toMatch(
      /const target = scaledTargetSize\(size\.width, size\.height, renderScale\)/,
    );
  });

  it('compares that target against the live texture size inside the early return', () => {
    const head = body.indexOf('if (');
    const end = body.indexOf('return true');
    expect(head).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(head);
    const condition = body.slice(head, end);
    expect(condition).toMatch(/size\.width === canvasWidth/);
    expect(condition).toMatch(/target\.width === width/);
    expect(condition).toMatch(/target\.height === height/);
  });
});

// --- Sampling-UV regression -------------------------------------------------
// A half-pixel bug shipped green here once: WebGPU's fragment
// @builtin(position) is ALREADY the pixel centre (fract(C) = (0.5, 0.5), so
// fragCoord = x + 0.5), and the old textureLoad(vec2<i32>(fragCoord.xy))
// relied on truncating that to x. Adding another vec2<f32>(0.5) put the UV
// exactly on the boundary between texel x and x + 1 -- every column shifted
// (1919/1920 at W=1920), and nothing in the suite covered the formula.
// Pin the exact expression so it cannot drift back.

describe('present-pass sampling UV (regression: half-pixel shift)', () => {
  // Comments may discuss the offset in prose; only executable code is pinned.
  const gridCode = stripComments(gridSource);
  const blitCode = stripComments(blitSource);

  it('grid.wgsl computes its UV as exactly fragCoord.xy * wireStyle.invCanvas', () => {
    expect(gridCode).toMatch(/^\s*let uv = fragCoord\.xy \* wireStyle\.invCanvas;$/m);
  });

  it('blit.wgsl computes its UV as exactly fragCoord.xy * postFlags.invCanvas', () => {
    expect(blitCode).toMatch(/^\s*let uv = fragCoord\.xy \* postFlags\.invCanvas;$/m);
  });

  it('neither shader adds a half pixel to the fragment position', () => {
    expect(gridCode).not.toMatch(/\+\s*vec2<f32>\(0\.5\)/);
    expect(blitCode).not.toMatch(/\+\s*vec2<f32>\(0\.5\)/);
    // Any additive term on fragCoord.xy itself moves the UV off the texel
    // centre -- there is no legitimate one in either present pass.
    expect(gridCode).not.toMatch(/fragCoord\.xy\s*\+/);
    expect(blitCode).not.toMatch(/fragCoord\.xy\s*\+/);
  });
});

// --- Post-effect gating (phase 4) -------------------------------------------
// The four effects exist only behind their style flags. Two properties are
// load-bearing and easy to break by accident: (a) each effect's code path is
// present and guarded -- otherwise a binding could be stripped from the
// automatic layout or the default style would change appearance -- and (b)
// with every flag 0 (the REALISTIC default) what remains must be a plain
// passthrough of the sample: a copy, with no arithmetic that could perturb a
// special float bit pattern. Regexes run over comment-stripped source, same
// approach as the UV pin above.

describe('post effects are gated behind their style flags (phase 4)', () => {
  const blitCode = stripComments(blitSource);

  /** Removes every `if (flags.*) { ... }` block. WGSL compound statements
   *  are always braced, so brace matching is exact. */
  function removeFlagGuards(source: string): string {
    let out = '';
    let cursor = 0;
    for (;;) {
      const at = source.indexOf('if (flags.', cursor);
      if (at === -1) return out + source.slice(cursor);
      out += source.slice(cursor, at);
      const open = source.indexOf('{', at);
      let depth = 0;
      let end = open;
      for (; end < source.length; end++) {
        if (source[end] === '{') depth += 1;
        else if (source[end] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      cursor = end + 1;
    }
  }

  /** Executable body of `fn <name>`: everything between the first `{` after
   *  the signature and its matching `}`. */
  function functionBody(source: string, name: string): string {
    const head = source.indexOf(`fn ${name}(`);
    expect(head, `fn ${name} not found`).toBeGreaterThanOrEqual(0);
    const open = source.indexOf('{', head);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(open + 1, i);
      }
    }
    throw new Error(`unbalanced braces in fn ${name}`);
  }

  it('reads the flags once and guards exactly one block per effect', () => {
    expect(blitCode).toMatch(/let flags = postFlags\.flags;/);
    for (const component of ['x', 'y', 'z', 'w']) {
      expect(blitCode, `flags.${component} guard`).toMatch(
        new RegExp(`if \\(flags\\.${component} > 0\\.5\\) \\{`),
      );
    }
  });

  it('runs the effects in the documented order: dither, palette, scanlines, vignette', () => {
    const marks = ['if (flags.y', 'if (flags.x', 'if (flags.z', 'if (flags.w'].map((mark) =>
      blitCode.indexOf(mark),
    );
    expect(marks.every((mark) => mark >= 0)).toBe(true);
    expect(marks).toEqual([...marks].sort((a, b) => a - b));
  });

  it('implements every effect behind its guard, with its documented constants', () => {
    // Ordered dither: classic 4x4 Bayer const + the amplitude it scales by.
    expect(blitCode).toMatch(/const BAYER_4X4: array<vec4<f32>, 4>/);
    expect(blitCode).toMatch(/const DITHER_AMPLITUDE: f32 = 1\.0 \/ 32\.0;/);
    // Palette: binding 3 is statically used (a guarded reference counts) and
    // the search is the squared-RGB-distance loop over the ramp.
    expect(blitCode).toMatch(/paletteRamp\.entries/);
    expect(blitCode).toMatch(/dot\(delta, delta\)/);
    // Scanlines: row parity derived from the output position, factor pinned.
    expect(blitCode).toMatch(/floor\(fragCoord\.y\)/);
    expect(blitCode).toMatch(/const SCANLINE_DARKEN: f32 = 0\.75;/);
    // Vignette: aspect correction divides the centred offset by invCanvas,
    // then the falloff runs through the pinned smoothstep + floor triple.
    expect(blitCode).toMatch(/pixelOffset \/ postFlags\.invCanvas/);
    expect(blitCode).toMatch(/const VIGNETTE_INNER: f32 = 0\.5;/);
    expect(blitCode).toMatch(/const VIGNETTE_OUTER: f32 = 1\.0;/);
    expect(blitCode).toMatch(/const VIGNETTE_FLOOR: f32 = 0\.5;/);
    expect(blitCode).toMatch(/smoothstep\(VIGNETTE_INNER, VIGNETTE_OUTER, r\)/);
  });

  it('pins the 4x4 Bayer matrix values, not just its declaration', () => {
    // The dither pattern IS these sixteen numbers: a re-ordered or duplicated
    // matrix changes the retro frame's texture while still compiling and
    // still matching `const BAYER_4X4: array<vec4<f32>, 4>`. Row-major,
    // exactly as declared -- the classic ordered-dither index matrix.
    const decl =
      /const\s+BAYER_4X4:\s*array<vec4<f32>,\s*4>\s*=\s*array<vec4<f32>,\s*4>\s*\(\s*([\s\S]*?)\);/.exec(
        blitCode,
      );
    expect(decl, 'BAYER_4X4 initializer not found in blit.wgsl').not.toBeNull();
    const values = (decl?.[1] ?? '')
      .replace(/vec4<f32>/g, '')
      .match(/\d+(?:\.\d+)?/g)
      ?.map(Number);
    expect(values).toEqual([
      0, 8, 2, 10,
      12, 4, 14, 6,
      3, 11, 1, 9,
      15, 7, 13, 5,
    ]);
    // Every index 0..15 exactly once: a repeat would bias one dither level
    // and an omission would flatten another.
    expect([...(values ?? [])].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
  });

  it('is a plain passthrough when every guard is skipped', () => {
    // Flags 0 mean no guarded block runs: what is left of the entry point
    // MUST be exactly sample -> copy -> return, statement for statement.
    const residual = removeFlagGuards(blitCode);
    const body = functionBody(residual, 'fs');
    // The palette read lives only inside its guard: binding 3 is reached
    // through the flag, and the identity path never touches the ramp.
    expect(body).not.toMatch(/paletteRamp/);
    const statements = body
      .split(';')
      .map((statement) => statement.replace(/\s+/g, ' ').trim())
      .filter((statement) => statement.length > 0);
    expect(statements).toEqual([
      'let uv = fragCoord.xy * postFlags.invCanvas',
      'let texel = textureSampleLevel(source, sourceSampler, uv, 0.0)',
      'let flags = postFlags.flags',
      'var color = texel.rgb',
      'return vec4<f32>(color, 1.0)',
    ]);
  });
});
