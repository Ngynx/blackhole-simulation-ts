// Overlay pass: draws the Flamm-paraboloid wireframe over the lensed image.
//
// This pass deliberately does NOT feel gravitational lensing. The reference
// (grid.vert / grid.frag in black_hole.cpp) renders the curvature sheet as a
// separate translucent pass in screen space, and the port keeps that
// behaviour.
//
// Occlusion: the reference draws the grid FIRST and lays the ray-traced image
// over it with blending, so the black hole (alpha 1) and the disk (alpha r)
// hide the sheet while empty space (alpha 0) lets it through. Our sky is
// never empty -- gradient, celestial grid and stars are always painted -- so
// instead of reordering the passes, geodesic3d.wgsl carries the same numbers
// in the storage texture's alpha channel and this shader reads them back.
// Same result: the wireframe is suppressed where it would sit behind solid
// geometry.
//
// Tint and base alpha come from the Style preset (src/render/style.ts)
// instead of literals, so a different preset can be selected later without
// editing this file. The default preset carries the grid.frag values verbatim:
//     FragColor = vec4(0.5, 0.5, 0.5, 0.7);
//
// The matrix is built by buildViewProjection() and must invert the ray
// construction in geodesic3d.wgsl, or the wireframe will not sit on the scene
// it describes.

struct Params {
  viewProj: mat4x4<f32>,
};

// LAYOUT (WGSL uniform address space): colorAlpha keeps byte 0..15 and the
// canvas reciprocal sits at byte 16. vec2<f32> only needs 8-byte alignment,
// so no explicit pad is required, but the uniform struct's total size rounds
// up from 24 to 32 bytes. Byte offsets are mirrored by
// buildWireStyleUniform() in src/render/styleUniforms.ts:
//   offset 0   colorAlpha.rgb = wireframe tint
//   offset 12  colorAlpha.a   = base opacity (0..1)
//   offset 16  invCanvas.xy   = 1 / canvas size (texel-centre UVs below)
struct WireStyleUniform {
  colorAlpha: vec4<f32>,
  invCanvas: vec2<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
// Occlusion mask written by the compute pass: 1 in the shadow, the disk's
// radial parameter across the annulus, 0 in open sky.
@group(0) @binding(1) var source: texture_2d<f32>;
@group(0) @binding(2) var<uniform> wireStyle: WireStyleUniform;
// Nearest-filtering sampler: at renderScale 1 the texel-centre UV below
// reproduces the old textureLoad() texel exactly; below 1 it repeats texels
// so the mask lines up with the chunky nearest upscale the blit performs.
@group(0) @binding(3) var sourceSampler: sampler;

struct VertexOutput {
  @builtin(position) clip: vec4<f32>,
};

@vertex
fn vs(@location(0) gridPos: vec3<f32>) -> VertexOutput {
  var out: VertexOutput;
  out.clip = params.viewProj * vec4<f32>(gridPos, 1.0);
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
  let uv = fragCoord.xy * wireStyle.invCanvas;
  let mask = textureSampleLevel(source, sourceSampler, uv, 0.0).a;
  // alpha * (1.0 - mask) reproduces the previous 0.7 * (1.0 - mask) exactly:
  // the uniform holds the same f32 value the literal used to.
  return vec4<f32>(
    wireStyle.colorAlpha.rgb,
    wireStyle.colorAlpha.a * (1.0 - mask),
  );
}
