(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=.05,t=6e3;function n(e,t){let n=Math.hypot(e.x,e.y),r=Math.atan2(e.y,e.x),i=t.x*Math.cos(r)+t.y*Math.sin(r),a=(-t.x*Math.sin(r)+t.y*Math.cos(r))/n,o=1-1/n;return{r:n,phi:r,dr:i,dphi:a,E:o*Math.sqrt(i*i/(o*o)+n*n*a*a/o),L:n*n*a}}function r(e,t){let{r:n,dr:r,dphi:i,E:a}=e,o=1-1/n,s=a/o;t[0]=r,t[1]=i,t[2]=-(1/(2*n*n))*o*(s*s)+1/(2*n*n*o)*(r*r)+n*o*(i*i),t[3]=-2*r*i/n}function i(e,t){if(1-1/e.r<=1e-6)return!1;let n=[e.r,e.phi,e.dr,e.dphi],r=o(n,e.E),i=o(a(n,r,t/2),e.E),s=o(a(n,i,t/2),e.E),c=o(a(n,s,t),e.E),l=n[0]+t/6*(r[0]+2*i[0]+2*s[0]+c[0]),u=n[1]+t/6*(r[1]+2*i[1]+2*s[1]+c[1]),d=n[2]+t/6*(r[2]+2*i[2]+2*s[2]+c[2]),f=n[3]+t/6*(r[3]+2*i[3]+2*s[3]+c[3]);return!Number.isFinite(l)||!Number.isFinite(u)||!Number.isFinite(d)||!Number.isFinite(f)?!1:(e.r=l,e.phi=u,e.dr=d,e.dphi=f,!0)}function a(e,t,n){return[e[0]+t[0]*n,e[1]+t[1]*n,e[2]+t[2]*n,e[3]+t[3]*n]}function o(e,t){let n={r:e[0],phi:e[1],dr:e[2],dphi:e[3],E:t,L:0},i=[0,0,0,0];return r(n,i),i}function s(t,n=e){return t.r<=1||!i(t,n)?`captured`:t.r>=200?`escaped`:`ok`}function c(e){return{x:e.r*Math.cos(e.phi),y:e.r*Math.sin(e.phi)}}function l(e,r){let i=n(e,r),a=[],o=c(i);a.push(o.x,o.y);let l=`ok`;for(let e=0;e<t&&(l=s(i),l===`ok`);e++){let e=c(i);a.push(e.x,e.y)}return{samples:a,outcome:l,ray:i}}function u(e){return e instanceof Error?e.message:String(e)}function d(e){let t=e.info;if(!t)return`adapter info unavailable`;let n=[t.vendor,t.architecture,t.device,t.description].filter(e=>typeof e==`string`&&e.length>0);return n.length>0?n.join(` · `):`adapter info unavailable`}async function f(){if(typeof navigator>`u`||!(`gpu`in navigator)||!navigator.gpu)return{ok:!1,reason:`navigator.gpu is undefined — this browser has no WebGPU support`};let e;try{e=await navigator.gpu.requestAdapter()}catch(e){return{ok:!1,reason:`requestAdapter() failed: ${u(e)}`}}if(!e)return{ok:!1,reason:`No GPU adapter available (the OS or driver refused WebGPU)`};let t;try{t=await e.requestDevice()}catch(e){return{ok:!1,reason:`requestDevice() rejected: ${u(e)}`}}return t.addEventListener(`uncapturederror`,e=>{console.error(`WebGPU validation: ${e.error.message}`)}),{ok:!0,adapter:e,device:t,info:d(e)}}function p(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`canvas.getContext("webgpu") returned null — the canvas is already claimed by another context`);return n.configure({device:e,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:`premultiplied`}),n}function m(e){let t=window.devicePixelRatio||1,n=Math.max(1,Math.round(e.clientWidth*t)),r=Math.max(1,Math.round(e.clientHeight*t));return(e.width!==n||e.height!==r)&&(e.width=n,e.height=r),{width:n,height:r}}var h=81,g=-12,_=-45,v=100,y=32,b=.05,x=.95,S=50,C=3*Math.sqrt(3)/2*1;function w(e){let t=Math.min(1,Math.abs(e)/S);return x-.77*t*t}var T=.25,E=.06;function D(e,t){return Math.max(T,E*Math.hypot(e,t))}function O(e,t,n){return Math.min(n,Math.max(t,e))}function k(e){if(e.length<=4)return e.slice();let t=[e[0],e[1]],n=e[0],r=e[1];for(let i=2;i<e.length;i+=2){let a=e[i],o=e[i+1],s=Math.min(D(n,r),D(a,o));Math.hypot(a-n,o-r)>=s&&(t.push(a,o),n=a,r=o)}let i=e.length;return(t[t.length-2]!==e[i-2]||t[t.length-1]!==e[i-1])&&t.push(e[i-2],e[i-1]),t}function A(e){return`hsl(${190+(e-g)/24*130} 72% 68%)`}function j(e,t){return Math.min(e/v,t/y)}function M(e){let t=e.getContext(`2d`);if(!t)throw Error(`2D canvas context unavailable`);return t}function N(){let e=[];for(let t=0;t<h;t++){let n=g+24*t/80,{samples:r}=l({x:_,y:n},{x:1,y:0});e.push({b:n,pts:k(r)})}return e}function P(e){let t=M(e),n=N(),r=!0,i=0,a={offsetX:0,offsetY:0,scale:1};function o(e,t,n,r){return{sx:n/2+(e-a.offsetX)*a.scale,sy:r/2-(t-a.offsetY)*a.scale}}function s(e,t,n,r){return{x:a.offsetX+(e-n/2)/a.scale,y:a.offsetY-(t-r/2)/a.scale}}function c(){a={offsetX:0,offsetY:0,scale:j(e.clientWidth||v,e.clientHeight||y)},f()}c();function l(){let n=window.devicePixelRatio||1,r=e.clientWidth,i=e.clientHeight;m(e),t.setTransform(n,0,0,n,0,0),t.fillStyle=`#05070c`,t.fillRect(0,0,r,i),d(r,i),u(r,i)}function u(e,n){let r=o(0,0,e,n),i=C*a.scale;t.beginPath(),t.arc(r.sx,r.sy,i,0,Math.PI*2),t.fillStyle=`#000000`,t.fill(),t.lineWidth=1,t.strokeStyle=`#3a3f4a`,t.stroke()}function d(e,r){t.lineWidth=window.devicePixelRatio>=2?1.5:1;for(let i of n){let n=i.pts,a=n.length/2;if(a<2)continue;t.strokeStyle=A(i.b);let s=w(n[0]);t.globalAlpha=s,t.beginPath();let c=o(n[0],n[1],e,r);t.moveTo(c.sx,c.sy);for(let i=1;i<a;i++){let a=w(n[2*i]);Math.abs(a-s)>b&&(c=o(n[2*(i-1)],n[2*(i-1)+1],e,r),t.lineTo(c.sx,c.sy),t.stroke(),s=a,t.globalAlpha=s,t.beginPath(),t.moveTo(c.sx,c.sy));let l=o(n[2*i],n[2*i+1],e,r);t.lineTo(l.sx,l.sy)}t.stroke()}t.globalAlpha=1}function f(){r=!0}function p(){r&&(r=!1,l()),i=requestAnimationFrame(p)}i=requestAnimationFrame(p);let h=!1,g=0,_=0,x=t=>{h=!0,g=t.clientX,_=t.clientY,e.setPointerCapture(t.pointerId)},S=e=>{if(!h)return;let t=e.clientX-g,n=e.clientY-_;g=e.clientX,_=e.clientY,a.offsetX-=t/a.scale,a.offsetY+=n/a.scale,f()},T=t=>{h=!1,e.hasPointerCapture(t.pointerId)&&e.releasePointerCapture(t.pointerId)},E=t=>{t.preventDefault();let n=e.getBoundingClientRect(),r=t.clientX-n.left,i=t.clientY-n.top,o=j(e.clientWidth||v,e.clientHeight||y),c=s(r,i,e.clientWidth,e.clientHeight);a.scale=O(a.scale*Math.exp(-t.deltaY*.0015),o*.2,o*10);let l=s(r,i,e.clientWidth,e.clientHeight);a.offsetX+=c.x-l.x,a.offsetY+=c.y-l.y,f()},D=e=>{(e.key===`r`||e.key===`R`)&&c()},k=new ResizeObserver(()=>{f()});return e.addEventListener(`pointerdown`,x),e.addEventListener(`pointermove`,S),e.addEventListener(`pointerup`,T),e.addEventListener(`pointercancel`,T),e.addEventListener(`wheel`,E,{passive:!1}),window.addEventListener(`keydown`,D),k.observe(e),{destroy(){cancelAnimationFrame(i),e.removeEventListener(`pointerdown`,x),e.removeEventListener(`pointermove`,S),e.removeEventListener(`pointerup`,T),e.removeEventListener(`pointercancel`,T),e.removeEventListener(`wheel`,E),window.removeEventListener(`keydown`,D),k.disconnect()},resize(){f()},requestRedraw:f}}var ee=`// Presents the compute pass's storage texture to the canvas.
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

// Entry count of the ramp; must match \`array<vec4<f32>, 12>\` above. The
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
  // \`color\` starts as a plain COPY of the sample. With all four flags 0 --
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
  //    is strict \`<\`. Cost is 11 dot products per fragment, only while the
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
  //    \`uv\` is fragCoord * invCanvas, so dividing the centred offset by
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
`,te=`// Schwarzschild null-geodesic march, one thread per output pixel.
//
// This is a line-by-line transcription of src/physics/geodesic3d.ts, which is
// where the equations are proved (vitest cannot execute WGSL). If you change
// one, change the other -- they are meant to be the same integrator. The disk
// plane-crossing test and the star segment/sphere test below are likewise
// mirrored by diskCrossing() and segmentSphereHit() there.
//
// Units: every length is in Schwarzschild radii (rs = 1). See the header of
// src/physics/constants.ts for why SI numbers cannot survive f32.
//
// The pass runs twice per frame:
//   1. \`main\` (compute) marches a camera ray for each pixel and writes colour
//      into a storage texture.
//   2. \`blit\` (see blit.wgsl) copies that texture to the canvas.

struct Camera {
  // xyz: camera position in rs, w: tan(half vertical field of view)
  posTan: vec4<f32>,
  // xyz: camera right axis, w: aspect ratio (width / height)
  rightAspect: vec4<f32>,
  // xyz: camera up axis
  up: vec4<f32>,
  // xyz: camera forward axis (unit)
  fwd: vec4<f32>,
};

@group(0) @binding(0) var<uniform> cam: Camera;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;

// --- Background objects ----------------------------------------------------
//
// The two static stars of the reference, packed by packStars() in
// src/physics/stars.ts. They are uniform data rather than WGSL constants so
// the geometry has exactly one source of truth on the CPU side; the only thing
// this shader has to agree on is the count.

struct Star {
  // xyz: centre in rs, w: radius in rs
  posRadius: vec4<f32>,
  // rgb: base colour, w: opaque alpha (stored, never read)
  color: vec4<f32>,
};

const STAR_COUNT: i32 = 2;

@group(0) @binding(2) var<uniform> objects: array<Star, STAR_COUNT>;

// --- Presentation style ---------------------------------------------------
//
// The sky's look comes from the active Style preset (src/render/style.ts)
// rather than literals, so a different preset can be selected later without
// editing this file. Physics never reads a Style: only skyColor() below is
// parameterised.
//
// LAYOUT (WGSL uniform address space, 16-byte alignment): every member is a
// vec4<f32>, so the struct is three packed vec4s with no implicit padding and
// no member needs an explicit @align/@size attribute. Byte offsets are
// mirrored by buildSkyStyleUniform() in src/render/styleUniforms.ts:
//   offset 0   lowGrid    rgb = gradient low colour,  a = grid strength
//   offset 16  highStars  rgb = gradient high colour, a = procedural stars
//                         (1 = on, 0 off)
//   offset 32  gridTint   rgb = celestial grid tint,  a = reserved, always 0
struct SkyStyleUniform {
  lowGrid: vec4<f32>,
  highStars: vec4<f32>,
  gridTint: vec4<f32>,
};

@group(0) @binding(3) var<uniform> skyStyle: SkyStyleUniform;

// --- Geometry of the problem, all in units of rs -------------------------

const RS: f32 = 1.0;
const ESCAPE_R: f32 = 500.0;
const CAPTURE_R: f32 = 1.0001;
const MAX_STEPS: i32 = 600;

// Affine step size scales with r: the field's structure lives near the hole,
// so a photon far away (where the path is straight) can afford a large step
// while one skimming the photon sphere needs small steps to resolve winding.
const STEP_FRACTION: f32 = 0.1;
const STEP_MIN: f32 = 0.02;
const STEP_MAX: f32 = 12.0;

// Grid drawn on the sky sphere, in radians (15 degrees). The grid is what
// makes the lensing legible: it is structure that visibly compresses toward
// the shadow and folds into the photon ring.
const SKY_GRID: f32 = 0.2617993;

// Accretion disk, in rs. uploadDiskUBO() in black_hole.cpp sets
// r1 = 2.2 r_s and r2 = 5.2 r_s. The disk is razor thin: it is the annulus
// in the y = 0 plane between those radii, with no vertical extent.
const DISK_R1: f32 = 2.2;
const DISK_R2: f32 = 5.2;

// --- Integrator -----------------------------------------------------------

// Right-hand side of the energy-reduced system, returned as [dr, dphi, d2r].
//
// Differentiating the null first integral (dr/dl)^2 = E^2 - f L^2 / r^2 with
// E normalised to 1 gives d^2r/dl^2 = -V'(r)/2 = (L^2 / r^4)(r - 1.5 rs).
// The numerator vanishing at r = 1.5 rs is the photon sphere, which is the
// free check that this algebra is right. Note there is no 1/f term anywhere:
// unlike the E/f formulation this form stays finite all the way to the horizon.
fn rhs(r: f32, dr: f32, L: f32) -> vec3<f32> {
  let r2 = r * r;
  let r4 = r2 * r2;
  return vec3<f32>(dr, L / r2, (L * L / r4) * (r - 1.5 * RS));
}

// One 4th-order Runge-Kutta step of the state y = [r, phi, dr].
fn rk4(y: vec3<f32>, L: f32, h: f32) -> vec3<f32> {
  let k1 = rhs(y.x, y.z, L);
  let k2 = rhs(y.x + 0.5 * h * k1.x, y.z + 0.5 * h * k1.z, L);
  let k3 = rhs(y.x + 0.5 * h * k2.x, y.z + 0.5 * h * k2.z, L);
  let k4 = rhs(y.x + h * k3.x, y.z + h * k3.z, L);
  return y + (h / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
}

// Any unit vector perpendicular to n. Only reachable for a purely radial
// photon, whose orbital plane is undefined; L = 0 makes the choice irrelevant.
fn perpendicular(n: vec3<f32>) -> vec3<f32> {
  let ax = abs(n.x);
  let ay = abs(n.y);
  let az = abs(n.z);
  var axis: vec3<f32>;
  if (ax <= ay && ax <= az) {
    axis = vec3<f32>(1.0, 0.0, 0.0);
  } else if (ay <= az) {
    axis = vec3<f32>(0.0, 1.0, 0.0);
  } else {
    axis = vec3<f32>(0.0, 0.0, 1.0);
  }
  return normalize(cross(n, axis));
}

// WGSL has no isFinite() builtin (calling one is a compile error), so the
// check is a magnitude bound. One comparison covers both failure modes: NaN
// fails every ordered comparison, and infinity exceeds any plausible value --
// the integrator's state never comes near 1e30 in units of rs.
fn finiteF32(x: f32) -> bool {
  return abs(x) < 1e30;
}

// Entry point of the segment prev -> next into the sphere, with a hit flag in
// .w (1 = hit, 0 = miss) because WGSL has no nullable type. .xyz is the entry
// point, or prev when prev already lies inside.
//
// WHY A SEGMENT AND NOT AN ENDPOINT
// ---------------------------------
// The reference tests distance(P, center) <= radius at the ENDPOINT of every
// step and gets away with it because it marches with a fixed D_LAMBDA of 1e7 m
// = 7.9e-4 rs. We cannot: our step is adaptive, h = clamp(0.1 r, 0.02, 12),
// and the stars sit at exactly ten times their own radius, so at their
// distance the step comes out to h = 0.1 * STAR_ORBIT = STAR_RADIUS -- one
// step equals one star radius. An endpoint test then loses every chord
// shorter than a step, i.e. the outer band of the projected disc (chord < h
// <=> impact parameter > sqrt(3)/2 * radius), roughly a quarter of the area:
// the rim would erode and flicker as the sample phase moved with the camera.
// Testing the whole segment is exact for a straight chord and independent of
// step length. geodesic3d.ts carries the same function with a proof.
fn segmentSphereHit(prev: vec3<f32>, next: vec3<f32>, center: vec3<f32>, radius: f32) -> vec4<f32> {
  let d = next - prev;
  let m = prev - center;
  let a = dot(d, d);
  let b = 2.0 * dot(m, d);
  let c = dot(m, m) - radius * radius;

  // prev already inside: the quadratic roots would both be negative.
  if (c <= 0.0) {
    return vec4<f32>(prev, 1.0);
  }
  // Degenerate segment: a point, and it is outside by the check above.
  if (a <= 0.0) {
    return vec4<f32>(prev, 0.0);
  }

  let disc = b * b - 4.0 * a * c;
  if (disc < 0.0) {
    return vec4<f32>(prev, 0.0);
  }

  // c > 0 and a > 0 make the roots share a sign (product = c/a), so the
  // smaller one is the entry point whenever the sphere lies ahead at all.
  let t = (-b - sqrt(disc)) / (2.0 * a);
  if (t < 0.0 || t > 1.0) {
    return vec4<f32>(prev, 0.0);
  }
  return vec4<f32>(prev + t * d, 1.0);
}

// --- Background -------------------------------------------------------------------------------------------------------------------

fn hash13(pIn: vec3<f32>) -> f32 {
  var p = fract(pIn * vec3<f32>(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

// Colour of a photon arriving from direction d. Everything here is procedural
// so the demo needs no texture assets, and every element has a job: the
// gradient gives the field something smooth to bend, the grid makes the
// distortion readable, and the stars are the classic lensing subject.
fn skyColor(dIn: vec3<f32>) -> vec3<f32> {
  let d = normalize(dIn);

  // Dim vertical gradient -- pure black would leave nothing to distort.
  var col = mix(skyStyle.lowGrid.rgb, skyStyle.highStars.rgb, 0.5 + 0.5 * d.y);

  // Meridians and parallels every 15 degrees. The strength scalar is part of
  // the style (0 disables the grid); with the default preset it is exactly
  // 1.0, and multiplying by 1.0f is exact, so the result is bit-identical to
  // the previous literal expression.
  let lon = atan2(d.z, d.x);
  let lat = asin(clamp(d.y, -1.0, 1.0));
  let dLon = SKY_GRID * abs(fract(lon / SKY_GRID + 0.5) - 0.5);
  let dLat = SKY_GRID * abs(fract(lat / SKY_GRID + 0.5) - 0.5);
  let grid = max(smoothstep(0.007, 0.0, dLon), smoothstep(0.007, 0.0, dLat));
  col += skyStyle.gridTint.rgb * (skyStyle.lowGrid.a * grid);

  // One candidate star per cell of a lattice laid over the sphere; a fourth,
  // independent hash decides whether the cell has a star at all so brightness
  // stays uncorrelated with position. The whole lattice is gated on the
  // style's procedural-star switch, which the default preset keeps on.
  if (skyStyle.highStars.w > 0.5) {
    let n = 90.0;
    let cell = floor(d * n);
    let sel = hash13(cell + vec3<f32>(113.0, 271.0, 397.0));
    if (sel > 0.88) {
      let pos = vec3<f32>(hash13(cell), hash13(cell + 17.0), hash13(cell + 43.0));
      let local = d * n - cell;
      let dist = length(local - (0.2 + 0.6 * pos));
      let mag = (sel - 0.88) / 0.12;
      col += vec3<f32>(0.85, 0.90, 1.0) * smoothstep(0.30, 0.0, dist) * mag * 1.4;
    }
  }
  return col;
}

// --- Entry point ----------------------------------------------------------

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(outputTex);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  // Pixel -> view direction. Screen y grows downward, world y grows upward,
  // hence the flip on ndc.y.
  let res = vec2<f32>(f32(dims.x), f32(dims.y));
  let px = (vec2<f32>(f32(gid.x), f32(gid.y)) + vec2<f32>(0.5, 0.5)) / res;
  let ndc = vec2<f32>(px.x * 2.0 - 1.0, 1.0 - px.y * 2.0);
  let tanHalf = cam.posTan.w;
  let aspect = cam.rightAspect.w;
  let dir = normalize(
    cam.fwd.xyz
      + ndc.x * aspect * tanHalf * cam.rightAspect.xyz
      + ndc.y * tanHalf * cam.up.xyz
  );

  // Build the orbital plane once: e1 points at the launch point (so phi = 0
  // sits there), e2 lies along the transverse part of dir.
  let origin = cam.posTan.xyz;
  var r = length(origin);
  var e1 = origin / r;
  let dR = dot(dir, e1);
  let t = dir - dR * e1;
  let dT = length(t);
  var e2 = vec3<f32>(0.0, 0.0, 1.0);
  if (dT > 1e-9) {
    e2 = t / dT;
  } else {
    e2 = perpendicular(e1);
  }

  // Null condition fixes the split between radial and transverse momentum.
  // With E = 1 the scale factor is sigma = 1/sqrt(d_r^2 + f d_t^2), giving
  // dr/dl = sigma * d_r and L = sigma * r * d_t (the impact parameter).
  let f = 1.0 - RS / r;
  let sigma = inverseSqrt(dR * dR + f * dT * dT);
  var y = vec3<f32>(r, 0.0, sigma * dR);
  let L = sigma * r * dT;

  var captured = false;
  // Cylindrical radius at which the ray crossed the disk, negative if it never
  // did. The integrator only knows r and phi inside the orbital plane, so the
  // cartesian point is rebuilt from the basis every step to test the plane.
  var diskHit = -1.0;
  // Index of the star the ray struck, negative when it struck none, plus the
  // surface entry point (needed for the shading normal).
  var starHit = -1;
  var starPoint = vec3<f32>(0.0);
  var prevPos = origin;
  for (var i: i32 = 0; i < MAX_STEPS; i = i + 1) {
    if (y.x <= CAPTURE_R) {
      captured = true;
      break;
    }
    if (y.x >= ESCAPE_R) {
      break;
    }
    let h = clamp(STEP_FRACTION * y.x, STEP_MIN, STEP_MAX);
    let next = rk4(y, L, h);
    if (!all(vec3<bool>(finiteF32(next.x), finiteF32(next.y), finiteF32(next.z)))) {
      // Only reachable if r collapsed onto the origin; report as capture
      // rather than letting NaN reach the texture.
      captured = true;
      break;
    }
    y = next;

    let cc = cos(y.y);
    let ss = sin(y.y);
    let pos = y.x * (cc * e1 + ss * e2);

    // The disk is the annulus in the y = 0 plane -- the same test
    // crossesEquatorialPlane() runs in the reference. A sign change brackets
    // the crossing, and interpolating to the exact plane keeps the hit
    // independent of the adaptive step length.
    if (prevPos.y * pos.y < 0.0) {
      let t = prevPos.y / (prevPos.y - pos.y);
      let hit = mix(prevPos, pos, t);
      let rho = length(hit.xz);
      if (rho >= DISK_R1 && rho <= DISK_R2) {
        diskHit = length(hit);
        break;
      }
    }

    // Stars, tested after the disk exactly as the reference orders them
    // (capture -> disk -> object). The whole segment is tested, not just the
    // endpoint -- see segmentSphereHit() above for why an endpoint test cannot
    // work at our step size. The two stars are far apart, so a ray can only
    // ever reach one of them; last write would be harmless either way.
    var starIdx = -1;
    var starEntry = vec3<f32>(0.0);
    for (var s: i32 = 0; s < STAR_COUNT; s = s + 1) {
      let center = objects[s].posRadius.xyz;
      let entry = segmentSphereHit(prevPos, pos, center, objects[s].posRadius.w);
      if (entry.w > 0.5) {
        starIdx = s;
        starEntry = entry.xyz;
      }
    }
    if (starIdx >= 0) {
      starHit = starIdx;
      starPoint = starEntry;
      break;
    }

    prevPos = pos;
  }

  var col = vec3<f32>(0.0);

  // Occlusion mask, carried in alpha: how much of anything drawn ON TOP of
  // this pixel should be suppressed.
  //
  // The reference composites the other way round -- it draws the grid first
  // and lays the raytraced image over it with blending, using exactly these
  // numbers (black hole alpha 1, disk alpha r, empty space alpha 0), so the
  // wireframe disappears behind the shadow and fades under the disk.
  //
  // Reordering our passes would work too, but our sky is never empty: the
  // gradient, the celestial grid and the stars are always drawn, so a single
  // image alpha cannot be 0 in the void and 1 on a star at once. Carrying the
  // reference's numbers in alpha instead keeps the opaque blit untouched and
  // lets the grid pass reproduce the same occlusion read-back.
  var mask = 0.0;
  if (captured) {
    // The shadow: pure black, no rim -- the rim is drawn by the eye, not us.
    col = vec3<f32>(0.0, 0.0, 0.0);
    mask = 1.0;
  } else if (diskHit >= 0.0) {
    // Reference: diskColor = vec3(1.0, r, 0.2) with r = |hit| / disk_r2, so r
    // runs from r1/r2 = 0.42 at the inner edge to 1.0 at the outer edge and
    // the annulus grades from red-orange to yellow. There is no other shading.
    let t = clamp(diskHit / DISK_R2, 0.0, 1.0);
    col = vec3<f32>(1.0, t, 0.2);
    mask = t;
  } else if (starHit >= 0) {
    // Reference shading (geodesic.comp): Lambert against the VIEW direction,
    // ambient 0.1, so a star limb-shades towards its silhouette instead of
    // reading as a flat coloured disc. N points out of the surface because the
    // entry point sits on the sphere around hitCenter.
    let star = objects[starHit];
    let n = normalize(starPoint - star.posRadius.xyz);
    let v = normalize(cam.posTan.xyz - starPoint);
    let intensity = 0.1 + 0.9 * max(dot(n, v), 0.0);
    col = star.color.rgb * intensity;
    // mask = 0: a star sits at ~31.5 rs, well BEYOND the Flamm lattice (which
    // spans +-9.9 rs), so the wireframe is the nearer surface and draws over
    // it. The shadow and the disk sit nearer than the lattice and suppress it
    // instead -- same rule, opposite sign.
    mask = 0.0;
  } else {
    // Rays that exhaust the step budget are near-critical (they wind around
    // the photon sphere). Sampling the sky with their current heading keeps the
    // shadow edge at b_c instead of inflating it.
    let c = cos(y.y);
    let s = sin(y.y);
    let rHat = c * e1 + s * e2;
    let phiHat = -s * e1 + c * e2;
    let vr = y.z;
    let vt = L / y.x;
    let vlen = sqrt(vr * vr + vt * vt);
    var vel = rHat;
    if (vlen > 0.0) {
      vel = normalize(vr * rHat + vt * phiHat);
    }
    col = skyColor(vel);
    mask = 0.0;
  }

  // Alpha carries the occlusion mask, not coverage: blit.wgsl ignores it and
  // forces alpha to 1, so the canvas is unaffected. grid.wgsl is the only
  // reader.
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(col, mask));
}
`,ne=`// Overlay pass: draws the Flamm-paraboloid wireframe over the lensed image.
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
`,F=1269e7,I=1e10/F,re=-3e10/F;function ie(e){return e>1?2*Math.sqrt(e-1)+re:-.36406619385342776}function ae(){let e=new Float32Array(2028),t=0;for(let n=0;n<26;n++)for(let r=0;r<26;r++){let i=(r-25/2)*I,a=(n-25/2)*I;e[t++]=i,e[t++]=ie(Math.hypot(i,a)),e[t++]=a}let n=new Uint16Array(2600),r=0;for(let e=0;e<26;e++)for(let t=0;t<26;t++){let i=e*26+t;t<25&&(n[r++]=i,n[r++]=i+1),e<25&&(n[r++]=i,n[r++]=i+26)}return{positions:e,indices:n}}var oe=1269e7,se=4e10/oe,ce=4e11/oe,L=[{pos:[ce,0,0],radius:se,color:[1,1,0]},{pos:[0,0,ce],radius:se,color:[1,0,0]}];function le(){let e=new Float32Array(L.length*8);return L.forEach((t,n)=>{let r=n*8;e[r]=t.pos[0],e[r+1]=t.pos[1],e[r+2]=t.pos[2],e[r+3]=t.radius,e[r+4]=t.color[0],e[r+5]=t.color[1],e[r+6]=t.color[2],e[r+7]=1}),e}var ue=.1,de=1e3;function R(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function fe(e,t=ue,n=de){let{pos:r,right:i,up:a,fwd:o,tanHalfFov:s,aspect:c}=e,l=c*s,u=n/(n-t),d=-t*n/(n-t),f=[[i[0]/l,i[1]/l,i[2]/l,-R(i,r)/l],[a[0]/s,a[1]/s,a[2]/s,-R(a,r)/s],[u*o[0],u*o[1],u*o[2],d-u*R(o,r)],[o[0],o[1],o[2],-R(o,r)]],p=new Float32Array(16);for(let e=0;e<4;e++)for(let t=0;t<4;t++)p[t*4+e]=f[e][t];return p}var z={name:`realistic`,renderScale:1,sky:{low:[.01,.016,.034],high:[.026,.04,.07],gridColor:[.03,.075,.12],gridStrength:1,proceduralStars:!0},wire:{color:[.5,.5,.5],alpha:.7},post:{palette:!1,dither:!1,scanlines:!1,vignette:!1},ui:{background:`#05070c`,panel:`#0a0c12`,border:`#1d222d`,text:`#8b93a7`,muted:`#4d5568`,ok:`#57d99a`,fail:`#ff7b72`}},B={name:`retro`,renderScale:.25,sky:{low:[.078,.067,.059],high:[.102,.086,.075],gridColor:[.3,.14,.05],gridStrength:.6,proceduralStars:!1},wire:{color:[.62,.4,.2],alpha:.7},post:{palette:!0,dither:!0,scanlines:!0,vignette:!0},ui:{background:`#120f0d`,panel:`#1a1512`,border:`#3a2a1c`,text:`#d9a066`,muted:`#8a5f3a`,ok:`#ff9a3c`,fail:`#ff5533`}},V={realistic:z,retro:B},H=`realistic`,pe=[[0,0,0],[.078,.067,.059],[.13,.11,.095],[.35,.06,.04],[.75,.14,.06],[1,.3,.08],[1,.45,.1],[1,.6,.15],[1,.75,.22],[1,.87,.35],[1,.95,.7],[1,.92,.62]];function me(e){return e==null?{style:V[H],known:!0}:e===`realistic`||e===`retro`?{style:V[e],known:!0}:{style:V[H],known:!1}}function U(e,t){return Math.max(1,Math.round(e*t))}function he(e,t,n){return{width:U(e,n),height:U(t,n)}}function ge(e,t,n){return t<=0||n<=0?0:e*n/t}function W(e){return+!!e}function G(e){let t=new Float32Array(12);return t.set(e.sky.low,0),t[3]=e.sky.gridStrength,t.set(e.sky.high,4),t[7]=W(e.sky.proceduralStars),t.set(e.sky.gridColor,8),t[11]=0,t}function K(e){let t=new Float32Array(8);return t.set(e.wire.color,0),t[3]=e.wire.alpha,t}function q(e){let t=new Float32Array(8);return t[0]=W(e.post.palette),t[1]=W(e.post.dither),t[2]=W(e.post.scanlines),t[3]=W(e.post.vignette),t}function _e(e){if(e.length!==12)throw Error(`palette must hold 12 entries, got ${e.length}`);let t=new Float32Array(48);for(let n=0;n<12;n++)t.set(e[n],n*4),t[n*4+3]=1;return t}function J(e,t){return new Float32Array([1/e,1/t])}function ve(e){let t=e*4;return Math.ceil(t/256)*256}async function ye(e,t,n){let r=p(e,t),i=navigator.gpu.getPreferredCanvasFormat();e.pushErrorScope(`validation`);let a=e.createShaderModule({label:`geodesic3d`,code:te}),o=e.createShaderModule({label:`blit`,code:ee}),s=e.createShaderModule({label:`grid`,code:ne}),c=e.createComputePipeline({label:`geodesic3d`,layout:`auto`,compute:{module:a,entryPoint:`main`}}),l=e.createRenderPipeline({label:`blit`,layout:`auto`,vertex:{module:o,entryPoint:`vs`},fragment:{module:o,entryPoint:`fs`,targets:[{format:i}]},primitive:{topology:`triangle-list`}}),u=e.createRenderPipeline({label:`grid`,layout:`auto`,vertex:{module:s,entryPoint:`vs`,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},fragment:{module:s,entryPoint:`fs`,targets:[{format:i,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`}}),d=await e.popErrorScope();if(d)throw Error(`WebGPU pipeline creation failed: ${d.message}`);let f=e.createSampler({label:`source-nearest`,magFilter:`nearest`,minFilter:`nearest`,mipmapFilter:`nearest`,addressModeU:`clamp-to-edge`,addressModeV:`clamp-to-edge`}),h=e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),g=e.createBuffer({label:`sky-style`,size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),_=e.createBuffer({label:`wire-style`,size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),v=e.createBuffer({label:`post-style`,size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),y=e.createBuffer({label:`palette-style`,size:192,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(g,0,G(n)),e.queue.writeBuffer(_,0,K(n)),e.queue.writeBuffer(v,0,q(n)),e.queue.writeBuffer(y,0,_e(pe));let b=e.createBuffer({label:`objects`,size:L.length*8*4,usage:GPUBufferUsage.UNIFORM,mappedAtCreation:!0});new Float32Array(b.getMappedRange()).set(le()),b.unmap();let x=ae(),S=e.createBuffer({label:`grid-vertices`,size:x.positions.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Float32Array(S.getMappedRange()).set(x.positions),S.unmap();let C=e.createBuffer({label:`grid-indices`,size:x.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Uint16Array(C.getMappedRange()).set(x.indices),C.unmap();let w=e.createBuffer({label:`grid-view-proj`,size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),T=new Float32Array(16),E=null,D=null,O=null,k=null,A=0,j=0,M=0,N=0,P=n.renderScale;function F(){let n=m(t),r=he(n.width,n.height,P);if(n.width===A&&n.height===j&&r.width===M&&r.height===N&&E&&D&&O&&k)return!0;E?.destroy(),A=n.width,j=n.height,M=r.width,N=r.height;let i=J(A,j);e.queue.writeBuffer(_,16,i),e.queue.writeBuffer(v,16,i),E=e.createTexture({size:{width:M,height:N},format:`rgba8unorm`,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});let a=E.createView();return D=e.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:h}},{binding:1,resource:a},{binding:2,resource:{buffer:b}},{binding:3,resource:{buffer:g}}]}),O=e.createBindGroup({layout:l.getBindGroupLayout(0),entries:[{binding:0,resource:a},{binding:1,resource:{buffer:v}},{binding:2,resource:f},{binding:3,resource:{buffer:y}}]}),k=e.createBindGroup({layout:u.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:w}},{binding:1,resource:a},{binding:2,resource:{buffer:_}},{binding:3,resource:f}]}),!0}function I(e){T.set(e.pos,0),T[3]=e.tanHalfFov,T.set(e.right,4),T[7]=e.aspect,T.set(e.up,8),T.set(e.fwd,12)}return{resize(){F()},setStyle(t){P=t.renderScale,F(),e.queue.writeBuffer(g,0,G(t)),e.queue.writeBuffer(_,0,K(t)),e.queue.writeBuffer(v,0,q(t));let n=J(A,j);e.queue.writeBuffer(_,16,n),e.queue.writeBuffer(v,16,n)},render(t){if(F(),!E||!D||!O||!k)return;I(t),e.queue.writeBuffer(h,0,T),e.queue.writeBuffer(w,0,fe(t));let n=e.createCommandEncoder(),i=n.beginComputePass();i.setPipeline(c),i.setBindGroup(0,D),i.dispatchWorkgroups(Math.ceil(M/8),Math.ceil(N/8)),i.end();let a=r.getCurrentTexture().createView(),o=n.beginRenderPass({colorAttachments:[{view:a,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});o.setPipeline(l),o.setBindGroup(0,O),o.draw(3),o.end();let s=n.beginRenderPass({colorAttachments:[{view:a,loadOp:`load`,storeOp:`store`}]});s.setPipeline(u),s.setBindGroup(0,k),s.setVertexBuffer(0,S),s.setIndexBuffer(C,`uint16`),s.drawIndexed(x.indices.length),s.end(),e.queue.submit([n.finish()])},async measureShadowDiameterCanvasPx(){if(!E||!M||!N)return 0;let t=ve(M),n=e.createBuffer({size:t*N,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),r=e.createCommandEncoder();r.copyTextureToBuffer({texture:E},{buffer:n,bytesPerRow:t,rowsPerImage:N},{width:M,height:N}),e.queue.submit([r.finish()]);try{await n.mapAsync(GPUMapMode.READ);let e=new Uint8Array(n.getMappedRange()),r=Math.floor(N/2),i=r*t,a=(n,r)=>{let i=r*t+n*4;return[e[i],e[i+1],e[i+2]]},o=0;for(let t=0;t<e.length;t+=4)e[t]>o&&(o=e[t]),e[t+1]>o&&(o=e[t+1]),e[t+2]>o&&(o=e[t+2]);console.log(`TEXEL_DEBUG max=${o} corner=${a(4,4)} centre=${a(Math.floor(M/2),r)}`);let s=t=>e[t+2]<=4,c=Math.floor(M/2);if(!s(i+c*4))return n.unmap(),n.destroy(),0;let l=c;for(;l>0&&s(i+(l-1)*4);)l--;let u=c;for(;u<M-1&&s(i+(u+1)*4);)u++;return n.unmap(),n.destroy(),ge(u-l+1,M,A)}catch{return 0}},destroy(){E?.destroy(),h.destroy(),b.destroy(),S.destroy(),C.destroy(),w.destroy(),g.destroy(),_.destroy(),v.destroy(),y.destroy()}}}function be(e){let{style:t,known:n}=me(e.get(`style`));return{style:t,known:n}}function xe(e,t){return e!==`3d`||t?``:` Unknown style value — falling back to realistic.`}function Se(e){return e.name===`realistic`?B:z}function Ce(e){if(!e.post.palette&&!e.post.dither)return e;let t=!(e.post.scanlines&&e.post.vignette);return{...e,post:{...e.post,scanlines:t,vignette:t}}}var we={background:`--bh-background`,panel:`--bh-panel`,border:`--bh-border`,text:`--bh-text`,muted:`--bh-muted`,ok:`--bh-ok`,fail:`--bh-fail`},Te=.92,Ee=`--bh-panel-veil`;function De(e,t){return`rgba(${parseInt(e.slice(1,3),16)}, ${parseInt(e.slice(3,5),16)}, ${parseInt(e.slice(5,7),16)}, ${t})`}function Oe(e,t){let n=t??document.documentElement;for(let[t,r]of Object.entries(we))n.style.setProperty(r,e.ui[t]);n.style.setProperty(Ee,De(e.ui.panel,Te))}var ke=40,Ae=-.55,je=.5,Me=40*Math.PI/180,Ne=6,Pe=400,Y=85*Math.PI/180,Fe=[0,1,0];function Ie(e){let t=e.post.palette||e.post.dither?`c: crt (scanlines+vignette, palette+dither stay)`:`c: crt (retro only)`;return`drag: orbit · wheel: zoom · r: reset view · s: style (${e.name}) · ${t}`}function Le(e,t,n){return Math.min(n,Math.max(t,e))}function Re(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function ze(e){let t=Math.hypot(e[0],e[1],e[2]);return[e[0]/t,e[1]/t,e[2]/t]}function Be(e,t,n,r){let i=Math.cos(n),a=[e*i*Math.cos(t),e*Math.sin(n),e*i*Math.sin(t)],o=ze([-a[0],-a[1],-a[2]]),s=ze(Re(o,Fe));return{pos:a,right:s,up:Re(s,o),fwd:o,tanHalfFov:Math.tan(Me/2),aspect:r}}async function Ve(e,t,n){let r=n.style,i=await ye(t,e,r);Oe(r),n.hint&&(n.hint.textContent=Ie(r));let a=!0,o=0,s=ke,c=Ae,l=je;function u(){s=ke,c=Ae,l=je,d()}u();function d(){a=!0}function f(e){e!==r&&(r=e,i.setStyle(e),Oe(e),n.hint&&(n.hint.textContent=Ie(e)),d())}let p=!1;function m(){if(a){a=!1,i.resize();let t=e.height>0?e.width/e.height:1;i.render(Be(s,c,l,t)),n.selfCheck&&!p&&(p=!0,i.measureShadowDiameterCanvasPx().then(e=>{console.log(`SHADOW_DIAMETER=${e}`)}))}o=requestAnimationFrame(m)}o=requestAnimationFrame(m);let h=!1,g=0,_=0,v=t=>{h=!0,g=t.clientX,_=t.clientY,e.setPointerCapture(t.pointerId)},y=e=>{if(!h)return;let t=e.clientX-g,n=e.clientY-_;g=e.clientX,_=e.clientY,c-=t*.005,l=Le(l+n*.005,-Y,Y),d()},b=t=>{h=!1,e.hasPointerCapture(t.pointerId)&&e.releasePointerCapture(t.pointerId)},x=e=>{e.preventDefault(),s=Le(s*Math.exp(e.deltaY*.001),Ne,Pe),d()},S=e=>{e.key===`r`||e.key===`R`?u():e.key===`s`||e.key===`S`?f(Se(r)):(e.key===`c`||e.key===`C`)&&f(Ce(r))},C=new ResizeObserver(()=>d());return e.addEventListener(`pointerdown`,v),e.addEventListener(`pointermove`,y),e.addEventListener(`pointerup`,b),e.addEventListener(`pointercancel`,b),e.addEventListener(`wheel`,x,{passive:!1}),window.addEventListener(`keydown`,S),C.observe(e),{destroy(){cancelAnimationFrame(o),e.removeEventListener(`pointerdown`,v),e.removeEventListener(`pointermove`,y),e.removeEventListener(`pointerup`,b),e.removeEventListener(`pointercancel`,b),e.removeEventListener(`wheel`,x),window.removeEventListener(`keydown`,S),C.disconnect(),i.destroy()},resize(){d()}}}var X=document.getElementById(`status`),Z=document.getElementById(`hint`),He=document.getElementById(`fallback`);function Ue(e){let t=document.getElementById(e);if(!(t instanceof HTMLCanvasElement))throw Error(`#${e} canvas is missing from index.html`);return t}var Q=Ue(`view`);function We(e){let t=e.get(`mode`);return t===`3d`?{mode:`3d`,known:!0}:t===`2d`||t===null?{mode:`2d`,known:!0}:{mode:`2d`,known:!1}}function Ge(e,t=``){X&&(X.classList.remove(`ok`,`fail`),e.ok?(X.classList.add(`ok`),X.textContent=`WebGPU ready — ${e.info}${t}`):(X.classList.add(`fail`),X.textContent=`WebGPU unavailable — ${e.reason}.${t}`))}function $(e){He&&(He.textContent=`This mode requires WebGPU, which is not available in this browser.\n\n${e}\n\nUse a current Chrome or Edge on macOS, or open the 2D lensing demo with ?mode=2d.`),X&&(X.style.display=`none`),Z&&(Z.style.display=`none`),Q.style.display=`none`}async function Ke(){let e=new URLSearchParams(window.location.search),{mode:t,known:n}=We(e),r=await f(),i=be(e),a=n?``:` Unknown mode value — falling back to 2D.`;if(a+=xe(t,i.known),Ge(r,a),t===`3d`){if(!r.ok){$(r.reason);return}let t=e.get(`check`)===`1`;try{await Ve(Q,r.device,{selfCheck:t,style:i.style,hint:Z})}catch(e){$(e instanceof Error?e.message:String(e))}return}Z&&(Z.textContent=`drag: pan · wheel: zoom · r: reset view`),P(Q)}Ke();
//# sourceMappingURL=index-CpuAaiMM.js.map