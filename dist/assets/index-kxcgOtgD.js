(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=.05,t=6e3;function n(e,t){let n=Math.hypot(e.x,e.y),r=Math.atan2(e.y,e.x),i=t.x*Math.cos(r)+t.y*Math.sin(r),a=(-t.x*Math.sin(r)+t.y*Math.cos(r))/n,o=1-1/n;return{r:n,phi:r,dr:i,dphi:a,E:o*Math.sqrt(i*i/(o*o)+n*n*a*a/o),L:n*n*a}}function r(e,t){let{r:n,dr:r,dphi:i,E:a}=e,o=1-1/n,s=a/o;t[0]=r,t[1]=i,t[2]=-(1/(2*n*n))*o*(s*s)+1/(2*n*n*o)*(r*r)+n*o*(i*i),t[3]=-2*r*i/n}function i(e,t){if(1-1/e.r<=1e-6)return!1;let n=[e.r,e.phi,e.dr,e.dphi],r=o(n,e.E),i=o(a(n,r,t/2),e.E),s=o(a(n,i,t/2),e.E),c=o(a(n,s,t),e.E),l=n[0]+t/6*(r[0]+2*i[0]+2*s[0]+c[0]),u=n[1]+t/6*(r[1]+2*i[1]+2*s[1]+c[1]),d=n[2]+t/6*(r[2]+2*i[2]+2*s[2]+c[2]),f=n[3]+t/6*(r[3]+2*i[3]+2*s[3]+c[3]);return!Number.isFinite(l)||!Number.isFinite(u)||!Number.isFinite(d)||!Number.isFinite(f)?!1:(e.r=l,e.phi=u,e.dr=d,e.dphi=f,!0)}function a(e,t,n){return[e[0]+t[0]*n,e[1]+t[1]*n,e[2]+t[2]*n,e[3]+t[3]*n]}function o(e,t){let n={r:e[0],phi:e[1],dr:e[2],dphi:e[3],E:t,L:0},i=[0,0,0,0];return r(n,i),i}function s(t,n=e){return t.r<=1||!i(t,n)?`captured`:t.r>=200?`escaped`:`ok`}function c(e){return{x:e.r*Math.cos(e.phi),y:e.r*Math.sin(e.phi)}}function l(e,r){let i=n(e,r),a=[],o=c(i);a.push(o.x,o.y);let l=`ok`;for(let e=0;e<t&&(l=s(i),l===`ok`);e++){let e=c(i);a.push(e.x,e.y)}return{samples:a,outcome:l,ray:i}}function u(e){return e instanceof Error?e.message:String(e)}function d(e){let t=e.info;if(!t)return`adapter info unavailable`;let n=[t.vendor,t.architecture,t.device,t.description].filter(e=>typeof e==`string`&&e.length>0);return n.length>0?n.join(` · `):`adapter info unavailable`}async function f(){if(typeof navigator>`u`||!(`gpu`in navigator)||!navigator.gpu)return{ok:!1,reason:`navigator.gpu is undefined — this browser has no WebGPU support`};let e;try{e=await navigator.gpu.requestAdapter()}catch(e){return{ok:!1,reason:`requestAdapter() failed: ${u(e)}`}}if(!e)return{ok:!1,reason:`No GPU adapter available (the OS or driver refused WebGPU)`};let t;try{t=await e.requestDevice()}catch(e){return{ok:!1,reason:`requestDevice() rejected: ${u(e)}`}}return t.addEventListener(`uncapturederror`,e=>{console.error(`WebGPU validation: ${e.error.message}`)}),{ok:!0,adapter:e,device:t,info:d(e)}}function p(e,t){let n=t.getContext(`webgpu`);if(!n)throw Error(`canvas.getContext("webgpu") returned null — the canvas is already claimed by another context`);return n.configure({device:e,format:navigator.gpu.getPreferredCanvasFormat(),alphaMode:`premultiplied`}),n}function m(e){let t=window.devicePixelRatio||1,n=Math.max(1,Math.round(e.clientWidth*t)),r=Math.max(1,Math.round(e.clientHeight*t));return(e.width!==n||e.height!==r)&&(e.width=n,e.height=r),{width:n,height:r}}var h=81,g=-12,_=-45,v=100,y=32,b=.05,x=.95,S=50,C=3*Math.sqrt(3)/2*1;function w(e){let t=Math.min(1,Math.abs(e)/S);return x-.77*t*t}var T=.25,E=.06;function D(e,t){return Math.max(T,E*Math.hypot(e,t))}function ee(e,t,n){return Math.min(n,Math.max(t,e))}function O(e){if(e.length<=4)return e.slice();let t=[e[0],e[1]],n=e[0],r=e[1];for(let i=2;i<e.length;i+=2){let a=e[i],o=e[i+1],s=Math.min(D(n,r),D(a,o));Math.hypot(a-n,o-r)>=s&&(t.push(a,o),n=a,r=o)}let i=e.length;return(t[t.length-2]!==e[i-2]||t[t.length-1]!==e[i-1])&&t.push(e[i-2],e[i-1]),t}function te(e){return`hsl(${190+(e-g)/24*130} 72% 68%)`}function k(e,t){return Math.min(e/v,t/y)}function A(e){let t=e.getContext(`2d`);if(!t)throw Error(`2D canvas context unavailable`);return t}function ne(){let e=[];for(let t=0;t<h;t++){let n=g+24*t/80,{samples:r}=l({x:_,y:n},{x:1,y:0});e.push({b:n,pts:O(r)})}return e}function re(e){let t=A(e),n=ne(),r=!0,i=0,a={offsetX:0,offsetY:0,scale:1};function o(e,t,n,r){return{sx:n/2+(e-a.offsetX)*a.scale,sy:r/2-(t-a.offsetY)*a.scale}}function s(e,t,n,r){return{x:a.offsetX+(e-n/2)/a.scale,y:a.offsetY-(t-r/2)/a.scale}}function c(){a={offsetX:0,offsetY:0,scale:k(e.clientWidth||v,e.clientHeight||y)},f()}c();function l(){let n=window.devicePixelRatio||1,r=e.clientWidth,i=e.clientHeight;m(e),t.setTransform(n,0,0,n,0,0),t.fillStyle=`#05070c`,t.fillRect(0,0,r,i),d(r,i),u(r,i)}function u(e,n){let r=o(0,0,e,n),i=C*a.scale;t.beginPath(),t.arc(r.sx,r.sy,i,0,Math.PI*2),t.fillStyle=`#000000`,t.fill(),t.lineWidth=1,t.strokeStyle=`#3a3f4a`,t.stroke()}function d(e,r){t.lineWidth=window.devicePixelRatio>=2?1.5:1;for(let i of n){let n=i.pts,a=n.length/2;if(a<2)continue;t.strokeStyle=te(i.b);let s=w(n[0]);t.globalAlpha=s,t.beginPath();let c=o(n[0],n[1],e,r);t.moveTo(c.sx,c.sy);for(let i=1;i<a;i++){let a=w(n[2*i]);Math.abs(a-s)>b&&(c=o(n[2*(i-1)],n[2*(i-1)+1],e,r),t.lineTo(c.sx,c.sy),t.stroke(),s=a,t.globalAlpha=s,t.beginPath(),t.moveTo(c.sx,c.sy));let l=o(n[2*i],n[2*i+1],e,r);t.lineTo(l.sx,l.sy)}t.stroke()}t.globalAlpha=1}function f(){r=!0}function p(){r&&(r=!1,l()),i=requestAnimationFrame(p)}i=requestAnimationFrame(p);let h=!1,g=0,_=0,x=t=>{h=!0,g=t.clientX,_=t.clientY,e.setPointerCapture(t.pointerId)},S=e=>{if(!h)return;let t=e.clientX-g,n=e.clientY-_;g=e.clientX,_=e.clientY,a.offsetX-=t/a.scale,a.offsetY+=n/a.scale,f()},T=t=>{h=!1,e.hasPointerCapture(t.pointerId)&&e.releasePointerCapture(t.pointerId)},E=t=>{t.preventDefault();let n=e.getBoundingClientRect(),r=t.clientX-n.left,i=t.clientY-n.top,o=k(e.clientWidth||v,e.clientHeight||y),c=s(r,i,e.clientWidth,e.clientHeight);a.scale=ee(a.scale*Math.exp(-t.deltaY*.0015),o*.2,o*10);let l=s(r,i,e.clientWidth,e.clientHeight);a.offsetX+=c.x-l.x,a.offsetY+=c.y-l.y,f()},D=e=>{(e.key===`r`||e.key===`R`)&&c()},O=new ResizeObserver(()=>{f()});return e.addEventListener(`pointerdown`,x),e.addEventListener(`pointermove`,S),e.addEventListener(`pointerup`,T),e.addEventListener(`pointercancel`,T),e.addEventListener(`wheel`,E,{passive:!1}),window.addEventListener(`keydown`,D),O.observe(e),{destroy(){cancelAnimationFrame(i),e.removeEventListener(`pointerdown`,x),e.removeEventListener(`pointermove`,S),e.removeEventListener(`pointerup`,T),e.removeEventListener(`pointercancel`,T),e.removeEventListener(`wheel`,E),window.removeEventListener(`keydown`,D),O.disconnect()},resize(){f()},requestRedraw:f}}var j=`// Presents the compute pass's storage texture to the canvas.
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
`,M=`// Schwarzschild null-geodesic march, one thread per output pixel.
//
// This is a line-by-line transcription of src/physics/geodesic3d.ts, which is
// where the equations are proved (vitest cannot execute WGSL). If you change
// one, change the other -- they are meant to be the same integrator. The disk
// plane-crossing test below is likewise mirrored by diskCrossing() there.
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
  // Cylindrical radius at which the ray crossed the disk, negative if it never
  // did. The integrator only knows r and phi inside the orbital plane, so the
  // cartesian point is rebuilt from the basis every step to test the plane.
  var diskHit = -1.0;
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
`,N=`// Overlay pass: draws the Flamm-paraboloid wireframe over the lensed image.
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
`,P=1269e7,F=1e10/P,ie=-3e10/P;function ae(e){return e>1?2*Math.sqrt(e-1)+ie:-.36406619385342776}function oe(){let e=new Float32Array(2028),t=0;for(let n=0;n<26;n++)for(let r=0;r<26;r++){let i=(r-25/2)*F,a=(n-25/2)*F;e[t++]=i,e[t++]=ae(Math.hypot(i,a)),e[t++]=a}let n=new Uint16Array(2600),r=0;for(let e=0;e<26;e++)for(let t=0;t<26;t++){let i=e*26+t;t<25&&(n[r++]=i,n[r++]=i+1),e<25&&(n[r++]=i,n[r++]=i+26)}return{positions:e,indices:n}}var se=.1,ce=1e3;function I(e,t){return e[0]*t[0]+e[1]*t[1]+e[2]*t[2]}function le(e,t=se,n=ce){let{pos:r,right:i,up:a,fwd:o,tanHalfFov:s,aspect:c}=e,l=c*s,u=n/(n-t),d=-t*n/(n-t),f=[[i[0]/l,i[1]/l,i[2]/l,-I(i,r)/l],[a[0]/s,a[1]/s,a[2]/s,-I(a,r)/s],[u*o[0],u*o[1],u*o[2],d-u*I(o,r)],[o[0],o[1],o[2],-I(o,r)]],p=new Float32Array(16);for(let e=0;e<4;e++)for(let t=0;t<4;t++)p[t*4+e]=f[e][t];return p}var L=16;function R(e){let t=e*4;return Math.ceil(t/256)*256}async function z(e,t){let n=p(e,t),r=navigator.gpu.getPreferredCanvasFormat();e.pushErrorScope(`validation`);let i=e.createShaderModule({label:`geodesic3d`,code:M}),a=e.createShaderModule({label:`blit`,code:j}),o=e.createShaderModule({label:`grid`,code:N}),s=e.createComputePipeline({label:`geodesic3d`,layout:`auto`,compute:{module:i,entryPoint:`main`}}),c=e.createRenderPipeline({label:`blit`,layout:`auto`,vertex:{module:a,entryPoint:`vs`},fragment:{module:a,entryPoint:`fs`,targets:[{format:r}]},primitive:{topology:`triangle-list`}}),l=e.createRenderPipeline({label:`grid`,layout:`auto`,vertex:{module:o,entryPoint:`vs`,buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:`float32x3`}]}]},fragment:{module:o,entryPoint:`fs`,targets:[{format:r,blend:{color:{srcFactor:`src-alpha`,dstFactor:`one-minus-src-alpha`,operation:`add`},alpha:{srcFactor:`one`,dstFactor:`one-minus-src-alpha`,operation:`add`}}}]},primitive:{topology:`line-list`}}),u=await e.popErrorScope();if(u)throw Error(`WebGPU pipeline creation failed: ${u.message}`);let d=e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),f=oe(),h=e.createBuffer({label:`grid-vertices`,size:f.positions.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Float32Array(h.getMappedRange()).set(f.positions),h.unmap();let g=e.createBuffer({label:`grid-indices`,size:f.indices.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST,mappedAtCreation:!0});new Uint16Array(g.getMappedRange()).set(f.indices),g.unmap();let _=e.createBuffer({label:`grid-view-proj`,size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),v=new Float32Array(L),y=null,b=null,x=null,S=null,C=0,w=0;function T(){let n=m(t);if(n.width===C&&n.height===w&&y&&b&&x&&S)return!0;y?.destroy(),C=n.width,w=n.height,y=e.createTexture({size:{width:C,height:w},format:`rgba8unorm`,usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});let r=y.createView();return b=e.createBindGroup({layout:s.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:d}},{binding:1,resource:r}]}),x=e.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:r}]}),S=e.createBindGroup({layout:l.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:_}},{binding:1,resource:r}]}),!0}function E(e){v.set(e.pos,0),v[3]=e.tanHalfFov,v.set(e.right,4),v[7]=e.aspect,v.set(e.up,8),v.set(e.fwd,12)}return{resize(){T()},render(t){if(T(),!y||!b||!x||!S)return;E(t),e.queue.writeBuffer(d,0,v),e.queue.writeBuffer(_,0,le(t));let r=e.createCommandEncoder(),i=r.beginComputePass();i.setPipeline(s),i.setBindGroup(0,b),i.dispatchWorkgroups(Math.ceil(C/8),Math.ceil(w/8)),i.end();let a=n.getCurrentTexture().createView(),o=r.beginRenderPass({colorAttachments:[{view:a,clearValue:{r:0,g:0,b:0,a:1},loadOp:`clear`,storeOp:`store`}]});o.setPipeline(c),o.setBindGroup(0,x),o.draw(3),o.end();let u=r.beginRenderPass({colorAttachments:[{view:a,loadOp:`load`,storeOp:`store`}]});u.setPipeline(l),u.setBindGroup(0,S),u.setVertexBuffer(0,h),u.setIndexBuffer(g,`uint16`),u.drawIndexed(f.indices.length),u.end(),e.queue.submit([r.finish()])},async measureShadowDiameter(){if(!y||!C||!w)return 0;let t=R(C),n=e.createBuffer({size:t*w,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),r=e.createCommandEncoder();r.copyTextureToBuffer({texture:y},{buffer:n,bytesPerRow:t,rowsPerImage:w},{width:C,height:w}),e.queue.submit([r.finish()]);try{await n.mapAsync(GPUMapMode.READ);let e=new Uint8Array(n.getMappedRange()),r=Math.floor(w/2),i=r*t,a=(n,r)=>{let i=r*t+n*4;return[e[i],e[i+1],e[i+2]]},o=0;for(let t=0;t<e.length;t+=4)e[t]>o&&(o=e[t]),e[t+1]>o&&(o=e[t+1]),e[t+2]>o&&(o=e[t+2]);console.log(`TEXEL_DEBUG max=${o} corner=${a(4,4)} centre=${a(Math.floor(C/2),r)}`);let s=t=>e[t+2]<=4,c=Math.floor(C/2);if(!s(i+c*4))return n.unmap(),n.destroy(),0;let l=c;for(;l>0&&s(i+(l-1)*4);)l--;let u=c;for(;u<C-1&&s(i+(u+1)*4);)u++;return n.unmap(),n.destroy(),u-l+1}catch{return 0}},destroy(){y?.destroy(),d.destroy(),h.destroy(),g.destroy(),_.destroy()}}}var B=40,V=-.55,H=.5,U=40*Math.PI/180,ue=6,de=400,W=85*Math.PI/180,fe=[0,1,0];function G(e,t,n){return Math.min(n,Math.max(t,e))}function K(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function q(e){let t=Math.hypot(e[0],e[1],e[2]);return[e[0]/t,e[1]/t,e[2]/t]}function pe(e,t,n,r){let i=Math.cos(n),a=[e*i*Math.cos(t),e*Math.sin(n),e*i*Math.sin(t)],o=q([-a[0],-a[1],-a[2]]),s=q(K(o,fe));return{pos:a,right:s,up:K(s,o),fwd:o,tanHalfFov:Math.tan(U/2),aspect:r}}async function J(e,t,n={}){let r=await z(t,e),i=!0,a=0,o=B,s=V,c=H;function l(){o=B,s=V,c=H,u()}l();function u(){i=!0}let d=!1;function f(){if(i){i=!1,r.resize();let t=e.height>0?e.width/e.height:1;r.render(pe(o,s,c,t)),n.selfCheck&&!d&&(d=!0,r.measureShadowDiameter().then(e=>{console.log(`SHADOW_DIAMETER=${e}`)}))}a=requestAnimationFrame(f)}a=requestAnimationFrame(f);let p=!1,m=0,h=0,g=t=>{p=!0,m=t.clientX,h=t.clientY,e.setPointerCapture(t.pointerId)},_=e=>{if(!p)return;let t=e.clientX-m,n=e.clientY-h;m=e.clientX,h=e.clientY,s-=t*.005,c=G(c+n*.005,-W,W),u()},v=t=>{p=!1,e.hasPointerCapture(t.pointerId)&&e.releasePointerCapture(t.pointerId)},y=e=>{e.preventDefault(),o=G(o*Math.exp(e.deltaY*.001),ue,de),u()},b=e=>{(e.key===`r`||e.key===`R`)&&l()},x=new ResizeObserver(()=>u());return e.addEventListener(`pointerdown`,g),e.addEventListener(`pointermove`,_),e.addEventListener(`pointerup`,v),e.addEventListener(`pointercancel`,v),e.addEventListener(`wheel`,y,{passive:!1}),window.addEventListener(`keydown`,b),x.observe(e),{destroy(){cancelAnimationFrame(a),e.removeEventListener(`pointerdown`,g),e.removeEventListener(`pointermove`,_),e.removeEventListener(`pointerup`,v),e.removeEventListener(`pointercancel`,v),e.removeEventListener(`wheel`,y),window.removeEventListener(`keydown`,b),x.disconnect(),r.destroy()},resize(){u()}}}var Y=document.getElementById(`status`),X=document.getElementById(`hint`),Z=document.getElementById(`fallback`);function me(e){let t=document.getElementById(e);if(!(t instanceof HTMLCanvasElement))throw Error(`#${e} canvas is missing from index.html`);return t}var Q=me(`view`);function he(){let e=new URLSearchParams(window.location.search).get(`mode`);return e===`3d`?{mode:`3d`,known:!0}:e===`2d`||e===null?{mode:`2d`,known:!0}:{mode:`2d`,known:!1}}function ge(e,t=``){Y&&(Y.classList.remove(`ok`,`fail`),e.ok?(Y.classList.add(`ok`),Y.textContent=`WebGPU ready — ${e.info}${t}`):(Y.classList.add(`fail`),Y.textContent=`WebGPU unavailable — ${e.reason}.${t}`))}function $(e){Z&&(Z.textContent=`This mode requires WebGPU, which is not available in this browser.\n\n${e}\n\nUse a current Chrome or Edge on macOS, or open the 2D lensing demo with ?mode=2d.`),Y&&(Y.style.display=`none`),X&&(X.style.display=`none`),Q.style.display=`none`}async function _e(){let{mode:e,known:t}=he(),n=await f();if(ge(n,t?``:` Unknown mode value — falling back to 2D.`),e===`3d`){if(!n.ok){$(n.reason);return}let e=new URLSearchParams(window.location.search).get(`check`)===`1`;X&&(X.textContent=`drag: orbit · wheel: zoom · r: reset view`);try{await J(Q,n.device,{selfCheck:e})}catch(e){$(e instanceof Error?e.message:String(e))}return}X&&(X.textContent=`drag: pan · wheel: zoom · r: reset view`),re(Q)}_e();
//# sourceMappingURL=index-kxcgOtgD.js.map