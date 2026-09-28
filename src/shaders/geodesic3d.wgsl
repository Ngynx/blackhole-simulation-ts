// Schwarzschild null-geodesic march, one thread per output pixel.
//
// This is a line-by-line transcription of src/physics/geodesic3d.ts, which is
// where the equations are proved (vitest cannot execute WGSL). If you change
// one, change the other -- they are meant to be the same integrator.
//
// Units: every length is in Schwarzschild radii (rs = 1). See the header of
// src/physics/constants.ts for why SI numbers cannot survive f32.
//
// The pass runs twice per frame:
//   1. `main` (compute) marches a camera ray for each pixel and writes colour
//      into a storage texture.
//   2. `blit` (see blit.wgsl) copies that texture to the canvas.

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
