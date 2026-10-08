// Presents the compute pass's storage texture to the canvas.
//
// The compute pass writes pixels; WebGPU cannot display a storage texture
// directly, so this pass draws one fullscreen triangle and samples the texel
// under each fragment. The sample then runs through the four phase-4
// post-processing effects (dither, palette, scanlines, vignette), each gated
// by its own Style flag, so the default preset -- all flags 0 -- keeps the
// plain nearest-neighbour upscale byte for byte.
//
// The storage texture may be SMALLER than the canvas (Style.renderScale, the
// retro preset renders at quarter resolution), so the read is a nearest-
// neighbour upscale driven by texel-centre UVs, not an index-identical copy.

@group(0) @binding(0) var source: texture_2d<f32>;

// Post-processing switches from the Style preset (src/render/style.ts).
// Declared, bound and (since phase 4) implemented: every effect below sits
// behind its own flag guard, and the default preset sends all four flags as
// 0, so no guard runs and the fragment shader returns the sample itself --
// today's output is unchanged.
//
// LAYOUT (WGSL uniform address space): flags keeps byte 0..15 and the canvas
// reciprocal sits at byte 16. vec2<f32> only needs 8-byte alignment, so no
// explicit pad is required, but the uniform struct's total size rounds up
// from 24 to 32 bytes. Byte offsets are mirrored by
// buildPostStyleUniform() in src/render/styleUniforms.ts:
//   offset 0   flags.x = palette quantisation (1 = on)
//   offset 4   flags.y = ordered dither
//   offset 8   flags.z = CRT scanlines
//   offset 12  flags.w = edge vignette
//   offset 16  invCanvas.xy = 1 / canvas size (texel-centre UVs below)
struct PostStyleFlags {
  flags: vec4<f32>,
  invCanvas: vec2<f32>,
};

@group(0) @binding(1) var<uniform> postFlags: PostStyleFlags;
// Nearest-filtering sampler: at renderScale 1 the texel-centre UV below
// reproduces the old textureLoad() texel exactly; below 1 it repeats texels
// for the chunky retro upscale instead of smoothing between them.
@group(0) @binding(2) var sourceSampler: sampler;

// The 12-colour quantisation ramp (phase 4). Single source of truth:
// RETRO_PALETTE in src/render/style.ts, packed by buildPaletteUniform() in
// src/render/styleUniforms.ts and uploaded once by gpuRenderer.ts. The ramp
// is NEVER re-typed as literals here -- only the entry count is mirrored, and
// shaderLayout.test.ts pins both that count and the struct size against
// RETRO_PALETTE.length.
//
// LAYOUT (WGSL uniform address space): a fixed-size array of vec4 elements.
// The element stride equals the element size (16 bytes), so 12 entries are
// exactly 12 * 16 = 192 bytes, no padding. Byte offsets, mirrored by
// buildPaletteUniform():
//   byte   0  entries[0]   RETRO_PALETTE[0]   rgb = ramp colour, a = 1
//   byte  16  entries[1]   RETRO_PALETTE[1]
//   ...
//   byte 176  entries[11]  RETRO_PALETTE[11]
// The alpha component is uploaded as 1.0 and ignored: quantisation reads
// .rgb only.
struct PaletteRamp {
  entries: array<vec4<f32>, 12>,
};

@group(0) @binding(3) var<uniform> paletteRamp: PaletteRamp;

// Entry count of the ramp; must match `array<vec4<f32>, 12>` above. The
// layout test derives the struct size from the parsed declaration and
// compares it with RETRO_PALETTE.length, so drift fails in CI rather than as
// a WebGPU bind-group validation error in the browser.
const PALETTE_SIZE: u32 = 12u;

// Classic 4x4 Bayer ordered-dither matrix (Ulichney), row-major, values
// 0..15. Normalised in the fragment shader as (v + 0.5) / 16 -- the CENTRES
// of 16 equal bins -- then centred on 0.5 so the offset is symmetric.
const BAYER_4X4: array<vec4<f32>, 4> = array<vec4<f32>, 4>(
  vec4<f32>(0.0, 8.0, 2.0, 10.0),
  vec4<f32>(12.0, 4.0, 14.0, 6.0),
  vec4<f32>(3.0, 11.0, 1.0, 9.0),
  vec4<f32>(15.0, 7.0, 13.0, 5.0),
);

// --- Phase-4 effect constants ---------------------------------------------
// Every constant below only matters behind its flag; none of them can reach
// the default (all-flags-0) path.

// Ordered-dither amplitude. The centred Bayer term spans +/-0.46875, so the
// peak offset is +/-0.46875 * (1/32) = +/-0.0146: about one sixth of one mean
// ramp step (the 12-entry ramp covers [0,1] across 11 gaps -> 1/11 ~= 0.091)
// and ~3.7/255 of the 8-bit range. Enough to flip quantisation decisions at
// band edges, invisible as noise on flat colour.
const DITHER_AMPLITUDE: f32 = 1.0 / 32.0;

// Scanline darkening: odd OUTPUT rows are multiplied by this. 0.75 leaves the
// frame at 87.5% average luminance -- a clear CRT line structure without the
// 50% loss a hard 0.5 factor would cost.
const SCANLINE_DARKEN: f32 = 0.75;

// Vignette falloff: brightness = mix(1, VIGNETTE_FLOOR,
// smoothstep(VIGNETTE_INNER, VIGNETTE_OUTER, r)), where r is the
// aspect-corrected distance from the centre in half-short-axis units.
//   INNER 0.5 -- inside half the short-axis radius nothing darkens, so the
//                black hole at the centre keeps its full brightness.
//   OUTER 1.0 -- full strength is reached at the short-axis edge midpoint;
//                on 16:9 the corners (r ~ 2.0) sit on the floor.
//   FLOOR 0.5 -- edges and corners keep half brightness: unmistakably a
//                vignette without crushing to black.
// smoothstep instead of a linear ramp: zero slope at both ends, so darkening
// fades in with no visible kink at INNER.
const VIGNETTE_INNER: f32 = 0.5;
const VIGNETTE_OUTER: f32 = 1.0;
const VIGNETTE_FLOOR: f32 = 0.5;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

// A single triangle covering the viewport: three vertices are cheaper than a
// quad's four, and the overhang outside [-1, 1] is simply clipped.
@vertex
fn vs(@builtin(vertex_index) index: u32) -> VertexOutput {
  var corners = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  var out: VertexOutput;
  out.position = vec4<f32>(corners[index], 0.0, 1.0);
  return out;
}

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  // UV in CANVAS space: @builtin(position) is already the pixel CENTRE
  // (WebGPU delivers fragCoord = x + 0.5 for pixel x), so the plain product
  // fragCoord.xy * invCanvas lands exactly in the middle of the texel it
  // reads. At renderScale 1 that resolves to the texel the old
  // textureLoad(vec2<i32>(fragCoord.xy)) truncated to -- byte-identical.
  // Below 1 the nearest sampler repeats it across the whole block. Adding
  // another half pixel would push the UV onto the boundary between texel x
  // and x + 1 and shift every read by one.
  let uv = fragCoord.xy * postFlags.invCanvas;
  let texel = textureSampleLevel(source, sourceSampler, uv, 0.0);

  // All four post flags, read OUTSIDE every guard: this line is load-bearing
  // beyond the effects -- a uniform no entry point mentions is stripped from
  // the automatic bind group layout, and the renderer's binding 1 would then
  // fail validation.
  let flags = postFlags.flags;

  // OPERATION ORDER (phase 4):
  //   sample -> optional dither offset -> optional palette quantisation
  //          -> optional scanlines -> optional vignette -> output alpha 1.0
  //
  // `color` starts as a plain COPY of the sample. With all four flags 0 --
  // the REALISTIC default -- no guarded block below executes, so the return
  // carries texel.rgb through untouched: not * 1.0, not + 0.0, a copy, so
  // no arithmetic can perturb a special float bit pattern. That is what keeps
  // the default app byte-identical to the pre-phase-4 path.
  var color = texel.rgb;

  // 1) Ordered dither (flags.y) -- BEFORE quantisation, so the ramp bands
  //    break up instead of stepping hard. The Bayer cell comes from the
  //    fragment's own OUTPUT position; u32() truncates the x + 0.5 pixel
  //    centre to the integer pixel, and nothing is ever ADDED to fragCoord
  //    (that half-pixel class of bug is pinned by a regression test).
  //    The offset can push a channel marginally outside [0,1]: the 8-bit
  //    presentation target clamps on write, and the quantisation below only
  //    ever picks a ramp entry, so no clamp is needed here.
  if (flags.y > 0.5) {
    let bx = u32(fragCoord.x) % 4u;
    let by = u32(fragCoord.y) % 4u;
    let centred = (BAYER_4X4[by][bx] + 0.5) / 16.0 - 0.5;
    color = color + centred * DITHER_AMPLITUDE;
  }

  // 2) Palette quantisation (flags.x) -- nearest entry of the 12-colour ramp
  //    by SQUARED EUCLIDEAN distance in RGB: sqrt is monotonic, so the argmin
  //    of the square is the argmin of the distance -- cheaper, identical
  //    choice. Ties keep the first (lowest-index) entry because the compare
  //    is strict `<`. Cost is 11 dot products per fragment, only while the
  //    flag is on -- trivial next to the geodesic march.
  if (flags.x > 0.5) {
    var best = 0u;
    let delta = color - paletteRamp.entries[0].rgb;
    var bestDist = dot(delta, delta);
    for (var i = 1u; i < PALETTE_SIZE; i = i + 1u) {
      let d = color - paletteRamp.entries[i].rgb;
      let dist = dot(d, d);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    color = paletteRamp.entries[best].rgb;
  }

  // 3) CRT scanlines (flags.z) -- darken alternate rows of the OUTPUT.
  //    fragCoord.y is the pixel centre (integer row + 0.5), so floor()
  //    recovers the row index and % 2 its parity. No term is added to
  //    fragCoord.xy -- see the pinned UV line above.
  if (flags.z > 0.5) {
    if (floor(fragCoord.y) % 2.0 == 1.0) {
      color = color * SCANLINE_DARKEN;
    }
  }

  // 4) Vignette (flags.w) -- radial darkening toward the frame edge.
  //    `uv` is fragCoord * invCanvas, so dividing the centred offset by
  //    invCanvas recovers the PIXEL offset from the centre: the falloff is
  //    then a circle on screen instead of an ellipse stretched by the canvas
  //    aspect -- that is the aspect correction, done with invCanvas. The
  //    length is normalised by HALF the short canvas side (2 * max of the
  //    two reciprocals = 2 / min(W, H)), so r = 1 exactly at the short-axis
  //    edge midpoint and every edge midpoint and corner is r >= 1.
  if (flags.w > 0.5) {
    let pixelOffset = uv - vec2<f32>(0.5);
    let pixels = pixelOffset / postFlags.invCanvas;
    let r = length(pixels) * 2.0 * max(postFlags.invCanvas.x, postFlags.invCanvas.y);
    let fall = smoothstep(VIGNETTE_INNER, VIGNETTE_OUTER, r);
    color = color * mix(1.0, VIGNETTE_FLOOR, fall);
  }

  // Canvas is configured with alphaMode: 'premultiplied', so an opaque pixel
  // carries rgb unchanged and alpha 1.
  return vec4<f32>(color, 1.0);
}
