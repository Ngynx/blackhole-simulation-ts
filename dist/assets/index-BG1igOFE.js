(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=.05,t=6e3;function n(e,t){let n=Math.hypot(e.x,e.y),r=Math.atan2(e.y,e.x),i=t.x*Math.cos(r)+t.y*Math.sin(r),a=(-t.x*Math.sin(r)+t.y*Math.cos(r))/n,o=1-1/n;return{r:n,phi:r,dr:i,dphi:a,E:o*Math.sqrt(i*i/(o*o)+n*n*a*a/o),L:n*n*a}}function r(e,t){let{r:n,dr:r,dphi:i,E:a}=e,o=1-1/n,s=a/o;t[0]=r,t[1]=i,t[2]=-(1/(2*n*n))*o*(s*s)+1/(2*n*n*o)*(r*r)+n*o*(i*i),t[3]=-2*r*i/n}function i(e,t){if(1-1/e.r<=1e-6)return!1;let n=[e.r,e.phi,e.dr,e.dphi],r=o(n,e.E),i=o(a(n,r,t/2),e.E),s=o(a(n,i,t/2),e.E),c=o(a(n,s,t),e.E),l=n[0]+t/6*(r[0]+2*i[0]+2*s[0]+c[0]),u=n[1]+t/6*(r[1]+2*i[1]+2*s[1]+c[1]),d=n[2]+t/6*(r[2]+2*i[2]+2*s[2]+c[2]),f=n[3]+t/6*(r[3]+2*i[3]+2*s[3]+c[3]);return!Number.isFinite(l)||!Number.isFinite(u)||!Number.isFinite(d)||!Number.isFinite(f)?!1:(e.r=l,e.phi=u,e.dr=d,e.dphi=f,!0)}function a(e,t,n){return[e[0]+t[0]*n,e[1]+t[1]*n,e[2]+t[2]*n,e[3]+t[3]*n]}function o(e,t){let n={r:e[0],phi:e[1],dr:e[2],dphi:e[3],E:t,L:0},i=[0,0,0,0];return r(n,i),i}function s(t,n=e){return t.r<=1||!i(t,n)?`captured`:t.r>=200?`escaped`:`ok`}function c(e){return{x:e.r*Math.cos(e.phi),y:e.r*Math.sin(e.phi)}}function l(e,r){let i=n(e,r),a=[],o=c(i);a.push(o.x,o.y);let l=`ok`;for(let e=0;e<t&&(l=s(i),l===`ok`);e++){let e=c(i);a.push(e.x,e.y)}return{samples:a,outcome:l,ray:i}}function u(e){return e instanceof Error?e.message:String(e)}function d(e){let t=e.info;if(!t)return`adapter info unavailable`;let n=[t.vendor,t.architecture,t.device,t.description].filter(e=>typeof e==`string`&&e.length>0);return n.length>0?n.join(` · `):`adapter info unavailable`}async function f(){if(typeof navigator>`u`||!(`gpu`in navigator)||!navigator.gpu)return{ok:!1,reason:`navigator.gpu is undefined — this browser has no WebGPU support`};let e;try{e=await navigator.gpu.requestAdapter()}catch(e){return{ok:!1,reason:`requestAdapter() failed: ${u(e)}`}}if(!e)return{ok:!1,reason:`No GPU adapter available (the OS or driver refused WebGPU)`};let t;try{t=await e.requestDevice()}catch(e){return{ok:!1,reason:`requestDevice() rejected: ${u(e)}`}}return t.addEventListener(`uncapturederror`,e=>{console.error(`WebGPU validation: ${e.error.message}`)}),{ok:!0,adapter:e,device:t,info:d(e)}}function p(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`canvas.getContext("webgpu") returned null — the canvas is already claimed by another context`);return n.configure({device:e,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:`premultiplied`}),n}function m(e){let t=window.devicePixelRatio||1,n=Math.max(1,Math.round(e.clientWidth*t)),r=Math.max(1,Math.round(e.clientHeight*t));return(e.width!==n||e.height!==r)&&(e.width=n,e.height=r),{width:n,height:r}}var h=81,g=-12,_=-45,v=100,y=32,b=.05,x=.95,S=50,C=3*Math.sqrt(3)/2*1;function w(e){let t=Math.min(1,Math.abs(e)/S);return x-.77*t*t}var T=.25,E=.06;function D(e,t){return Math.max(T,E*Math.hypot(e,t))}function ee(e,t,n){return Math.min(n,Math.max(t,e))}function O(e){if(e.length<=4)return e.slice();let t=[e[0],e[1]],n=e[0],r=e[1];for(let i=2;i<e.length;i+=2){let a=e[i],o=e[i+1],s=Math.min(D(n,r),D(a,o));Math.hypot(a-n,o-r)>=s&&(t.push(a,o),n=a,r=o)}let i=e.length;return(t[t.length-2]!==e[i-2]||t[t.length-1]!==e[i-1])&&t.push(e[i-2],e[i-1]),t}function te(e){return`hsl(${190+(e-g)/24*130} 72% 68%)`}function k(e,t){return Math.min(e/v,t/y)}function A(e){let t=e.getContext(`2d`);if(!t)throw Error(`2D canvas context unavailable`);return t}function j(){let e=[];for(let t=0;t<h;t++){let n=g+24*t/80,{samples:r}=l({x:_,y:n},{x:1,y:0});e.push({b:n,pts:O(r)})}return e}function M(e){let t=A(e),n=j(),r=!0,i=0,a={offsetX:0,offsetY:0,scale:1};function o(e,t,n,r){return{sx:n/2+(e-a.offsetX)*a.scale,sy:r/2-(t-a.offsetY)*a.scale}}function s(e,t,n,r){return{x:a.offsetX+(e-n/2)/a.scale,y:a.offsetY-(t-r/2)/a.scale}}function c(){a={offsetX:0,offsetY:0,scale:k(e.clientWidth||v,e.clientHeight||y)},f()}c();function l(){let n=window.devicePixelRatio||1,r=e.clientWidth,i=e.clientHeight;m(e),t.setTransform(n,0,0,n,0,0),t.fillStyle=`#05070c`,t.fillRect(0,0,r,i),d(r,i),u(r,i)}function u(e,n){let r=o(0,0,e,n),i=C*a.scale;t.beginPath(),t.arc(r.sx,r.sy,i,0,Math.PI*2),t.fillStyle=`#000000`,t.fill(),t.lineWidth=1,t.strokeStyle=`#3a3f4a`,t.stroke()}function d(e,r){t.lineWidth=window.devicePixelRatio>=2?1.5:1;for(let i of n){let n=i.pts,a=n.length/2;if(a<2)continue;t.strokeStyle=te(i.b);let s=w(n[0]);t.globalAlpha=s,t.beginPath();let c=o(n[0],n[1],e,r);t.moveTo(c.sx,c.sy);for(let i=1;i<a;i++){let a=w(n[2*i]);Math.abs(a-s)>b&&(c=o(n[2*(i-1)],n[2*(i-1)+1],e,r),t.lineTo(c.sx,c.sy),t.stroke(),s=a,t.globalAlpha=s,t.beginPath(),t.moveTo(c.sx,c.sy));let l=o(n[2*i],n[2*i+1],e,r);t.lineTo(l.sx,l.sy)}t.stroke()}t.globalAlpha=1}function f(){r=!0}function p(){r&&(r=!1,l()),i=requestAnimationFrame(p)}i=requestAnimationFrame(p);let h=!1,g=0,_=0,x=t=>{h=!0,g=t.clientX,_=t.clientY,e.setPointerCapture(t.pointerId)},S=e=>{if(!h)return;let t=e.clientX-g,n=e.clientY-_;g=e.clientX,_=e.clientY,a.offsetX-=t/a.scale,a.offsetY+=n/a.scale,f()},T=t=>{h=!1,e.hasPointerCapture(t.pointerId)&&e.releasePointerCapture(t.pointerId)},E=t=>{t.preventDefault();let n=e.getBoundingClientRect(),r=t.clientX-n.left,i=t.clientY-n.top,o=k(e.clientWidth||v,e.clientHeight||y),c=s(r,i,e.clientWidth,e.clientHeight);a.scale=ee(a.scale*Math.exp(-t.deltaY*.0015),o*.2,o*10);let l=s(r,i,e.clientWidth,e.clientHeight);a.offsetX+=c.x-l.x,a.offsetY+=c.y-l.y,f()},D=e=>{(e.key===`r`||e.key===`R`)&&c()},O=new ResizeObserver(()=>{f()});return e.addEventListener(`pointerdown`,x),e.addEventListener(`pointermove`,S),e.addEventListener(`pointerup`,T),e.addEventListener(`pointercancel`,T),e.addEventListener(`wheel`,E,{passive:!1}),window.addEventListener(`keydown`,D),O.observe(e),{destroy(){cancelAnimationFrame(i),e.removeEventListener(`pointerdown`,x),e.removeEventListener(`pointermove`,S),e.removeEventListener(`pointerup`,T),e.removeEventListener(`pointercancel`,T),e.removeEventListener(`wheel`,E),window.removeEventListener(`keydown`,D),O.disconnect()},resize(){f()},requestRedraw:f}}var N=`// Presents the compute pass's storage texture to the canvas.
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
`,P=`// Schwarzschild null-geodesic march, one thread per output pixel.
//
// This is a line-by-line transcription of src/physics/geodesic3d.ts, which is
// where the equations are proved (vitest cannot execute WGSL). If you change
// one, change the other -- they are meant to be the same integrator.
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
  var col = mix(vec3<f32>(0.010, 0.016, 0.034), vec3<f32>(0.026, 0.040, 0.070), 0.5 + 0.5 * d.y);

  // Meridians and parallels every 15 degrees.
  let lon = atan2(d.z, d.x);
  let lat = asin(clamp(d.y, -1.0, 1.0));
  let dLon = SKY_GRID * abs(fract(lon / SKY_GRID + 0.5) - 0.5);
  let dLat = SKY_GRID * abs(fract(lat / SKY_GRID + 0.5) - 0.5);
  let grid = max(smoothstep(0.007, 0.0, dLon), smoothstep(0.007, 0.0, dLat));
  col += vec3<f32>(0.030, 0.075, 0.120) * grid;

  // One candidate star per cell of a lattice laid over the sphere; a fourth,
  // independent hash decides whether the cell has a star at all so brightness
  // stays uncorrelated with position.
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
  }

  var col = vec3<f32>(0.0);
  if (captured) {
    // The shadow: pure black, no rim -- the rim is drawn by the eye, not us.
    col = vec3<f32>(0.0, 0.0, 0.0);
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
  }

  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(col, 1.0));
}
`,F=16;function I(e){let t=e*4;return Math.ceil(t/256)*256}async function L(e,t){let n=p(e,t),r=navigator.gpu.getPreferredCanvasFormat();e.pushErrorScope(`validation`);let i=e.createShaderModule({label:`geodesic3d`,code:P}),a=e.createShaderModule({label:`blit`,code:N}),o=e.createComputePipeline({label:`geodesic3d`,layout:`auto`,compute:{module:i,entryPoint:`main`}}),s=e.createRenderPipeline({label:`blit`,layout:`auto`,vertex:{module:a,entryPoint:`vs`},fragment:{module:a,entryPoint:`fs`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),c=await e.popErrorScope();if(c)throw Error(`WebGPU pipeline creation failed: ${c.message}`);let l=e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),u=new Float32Array(F),d=null,f=null,h=null,g=0,_=0;function v(){let n=m(t);return n.width===g&&n.height===_&&d&&f&&h?!0:(d?.destroy(),g=n.width,_=n.height,d=e.createTexture({size:{width:g,height:_},format:`rgba8unorm`,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC}),f=e.createBindGroup({layout:o.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:l}},{binding:1,resource:d.createView()}]}),h=e.createBindGroup({layout:s.getBindGroupLayout(0),entries:[{binding:0,resource:d.createView()}]}),!0)}function y(e){u.set(e.pos,0),u[3]=e.tanHalfFov,u.set(e.right,4),u[7]=e.aspect,u.set(e.up,8),u.set(e.fwd,12)}return{resize(){v()},render(t){if(v(),!d||!f||!h)return;y(t),e.queue.writeBuffer(l,0,u);let r=e.createCommandEncoder(),i=r.beginComputePass();i.setPipeline(o),i.setBindGroup(0,f),i.dispatchWorkgroups(Math.ceil(g/8),Math.ceil(_/8)),i.end();let a=r.beginRenderPass({colorAttachments:[{view:n.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});a.setPipeline(s),a.setBindGroup(0,h),a.draw(3),a.end(),e.queue.submit([r.finish()])},async measureShadowDiameter(){if(!d||!g||!_)return 0;let t=I(g),n=e.createBuffer({size:t*_,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),r=e.createCommandEncoder();r.copyTextureToBuffer({texture:d},{buffer:n,bytesPerRow:t,rowsPerImage:_},{width:g,height:_}),e.queue.submit([r.finish()]);try{await n.mapAsync(GPUMapMode.READ);let e=new Uint8Array(n.getMappedRange()),r=Math.floor(_/2),i=r*t,a=(n,r)=>{let i=r*t+n*4;return[e[i],e[i+1],e[i+2]]},o=0;for(let t=0;t<e.length;t+=4)e[t]>o&&(o=e[t]),e[t+1]>o&&(o=e[t+1]),e[t+2]>o&&(o=e[t+2]);console.log(`TEXEL_DEBUG max=${o} corner=${a(4,4)} centre=${a(Math.floor(g/2),r)}`);let s=t=>e[t+2]<=4,c=Math.floor(g/2);if(!s(i+c*4))return n.unmap(),n.destroy(),0;let l=c;for(;l>0&&s(i+(l-1)*4);)l--;let u=c;for(;u<g-1&&s(i+(u+1)*4);)u++;return n.unmap(),n.destroy(),u-l+1}catch{return 0}},destroy(){d?.destroy(),l.destroy()}}}var R=40,z=-.55,B=.18,V=40*Math.PI/180,H=6,U=400,W=85*Math.PI/180,G=[0,1,0];function K(e,t,n){return Math.min(n,Math.max(t,e))}function q(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function J(e){let t=Math.hypot(e[0],e[1],e[2]);return[e[0]/t,e[1]/t,e[2]/t]}function ne(e,t,n,r){let i=Math.cos(n),a=[e*i*Math.cos(t),e*Math.sin(n),e*i*Math.sin(t)],o=J([-a[0],-a[1],-a[2]]),s=J(q(o,G));return{pos:a,right:s,up:q(s,o),fwd:o,tanHalfFov:Math.tan(V/2),aspect:r}}async function re(e,t,n={}){let r=await L(t,e),i=!0,a=0,o=R,s=z,c=B;function l(){o=R,s=z,c=B,u()}l();function u(){i=!0}let d=!1;function f(){if(i){i=!1,r.resize();let t=e.height>0?e.width/e.height:1;r.render(ne(o,s,c,t)),n.selfCheck&&!d&&(d=!0,r.measureShadowDiameter().then(e=>{console.log(`SHADOW_DIAMETER=${e}`)}))}a=requestAnimationFrame(f)}a=requestAnimationFrame(f);let p=!1,m=0,h=0,g=t=>{p=!0,m=t.clientX,h=t.clientY,e.setPointerCapture(t.pointerId)},_=e=>{if(!p)return;let t=e.clientX-m,n=e.clientY-h;m=e.clientX,h=e.clientY,s-=t*.005,c=K(c+n*.005,-W,W),u()},v=t=>{p=!1,e.hasPointerCapture(t.pointerId)&&e.releasePointerCapture(t.pointerId)},y=e=>{e.preventDefault(),o=K(o*Math.exp(e.deltaY*.001),H,U),u()},b=e=>{(e.key===`r`||e.key===`R`)&&l()},x=new ResizeObserver(()=>u());return e.addEventListener(`pointerdown`,g),e.addEventListener(`pointermove`,_),e.addEventListener(`pointerup`,v),e.addEventListener(`pointercancel`,v),e.addEventListener(`wheel`,y,{passive:!1}),window.addEventListener(`keydown`,b),x.observe(e),{destroy(){cancelAnimationFrame(a),e.removeEventListener(`pointerdown`,g),e.removeEventListener(`pointermove`,_),e.removeEventListener(`pointerup`,v),e.removeEventListener(`pointercancel`,v),e.removeEventListener(`wheel`,y),window.removeEventListener(`keydown`,b),x.disconnect(),r.destroy()},resize(){u()}}}var Y=document.getElementById(`status`),X=document.getElementById(`hint`),Z=document.getElementById(`fallback`);function ie(e){let t=document.getElementById(e);if(!(t instanceof HTMLCanvasElement))throw Error(`#${e} canvas is missing from index.html`);return t}var Q=ie(`view`);function ae(){let e=new URLSearchParams(window.location.search).get(`mode`);return e===`3d`?{mode:`3d`,known:!0}:e===`2d`||e===null?{mode:`2d`,known:!0}:{mode:`2d`,known:!1}}function oe(e,t=``){Y&&(Y.classList.remove(`ok`,`fail`),e.ok?(Y.classList.add(`ok`),Y.textContent=`WebGPU ready — ${e.info}${t}`):(Y.classList.add(`fail`),Y.textContent=`WebGPU unavailable — ${e.reason}.${t}`))}function $(e){Z&&(Z.textContent=`This mode requires WebGPU, which is not available in this browser.\n\n${e}\n\nUse a current Chrome or Edge on macOS, or open the 2D lensing demo with ?mode=2d.`),Y&&(Y.style.display=`none`),X&&(X.style.display=`none`),Q.style.display=`none`}async function se(){let{mode:e,known:t}=ae(),n=await f();if(oe(n,t?``:` Unknown mode value — falling back to 2D.`),e===`3d`){if(!n.ok){$(n.reason);return}let e=new URLSearchParams(window.location.search).get(`check`)===`1`;X&&(X.textContent=`drag: orbit · wheel: zoom · r: reset view`);try{await re(Q,n.device,{selfCheck:e})}catch(e){$(e instanceof Error?e.message:String(e))}return}X&&(X.textContent=`drag: pan · wheel: zoom · r: reset view`),M(Q)}se();
//# sourceMappingURL=index-BG1igOFE.js.map