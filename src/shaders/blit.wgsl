// Presents the compute pass's storage texture to the canvas.
//
// The compute pass writes pixels; WebGPU cannot display a storage texture
// directly, so this pass draws one fullscreen triangle and copies the texel
// under each fragment. It is deliberately dumb -- all the interesting work
// already happened in geodesic3d.wgsl.

@group(0) @binding(0) var source: texture_2d<f32>;

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
  // fragCoord.xy is already in framebuffer pixels, and the storage texture is
  // sized to the same backing store, so the indices line up directly.
  let texel = textureLoad(source, vec2<i32>(fragCoord.xy), 0);
  // Canvas is configured with alphaMode: 'premultiplied', so an opaque pixel
  // carries rgb unchanged and alpha 1.
  return vec4<f32>(texel.rgb, 1.0);
}
