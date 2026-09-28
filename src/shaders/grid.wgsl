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
// Colour and base alpha are copied verbatim from grid.frag:
//     FragColor = vec4(0.5, 0.5, 0.5, 0.7);
//
// The matrix is built by buildViewProjection() and must invert the ray
// construction in geodesic3d.wgsl, or the wireframe will not sit on the scene
// it describes.

struct Params {
  viewProj: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> params: Params;
// Occlusion mask written by the compute pass: 1 in the shadow, the disk's
// radial parameter across the annulus, 0 in open sky.
@group(0) @binding(1) var source: texture_2d<f32>;

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
  let mask = textureLoad(source, vec2<i32>(fragCoord.xy), 0).a;
  return vec4<f32>(0.5, 0.5, 0.5, 0.7 * (1.0 - mask));
}
