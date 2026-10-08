// Schwarzschild null-geodesic march, one thread per output pixel.
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
