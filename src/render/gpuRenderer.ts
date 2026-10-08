import blitCode from '../shaders/blit.wgsl?raw';
import geodesicCode from '../shaders/geodesic3d.wgsl?raw';
import gridCode from '../shaders/grid.wgsl?raw';
import { buildFlammMesh } from '../physics/flamm';
import { packStars, STAR_FLOATS, STARS } from '../physics/stars';
import { configureCanvasContext, resizeCanvasToDisplaySize } from './webgpu';
import { buildViewProjection, VIEW_PROJECTION_FLOATS } from './viewProjection';
import { RETRO_PALETTE, type Style } from './style';
import { scaledTargetSize, texelsToCanvasPixels } from './renderScale';
import {
  buildInvCanvasUniform,
  buildPaletteUniform,
  buildPostStyleUniform,
  buildSkyStyleUniform,
  buildWireStyleUniform,
  PALETTE_UNIFORM_FLOATS,
  POST_INV_CANVAS_OFFSET,
  POST_UNIFORM_FLOATS,
  SKY_UNIFORM_FLOATS,
  WIRE_INV_CANVAS_OFFSET,
  WIRE_UNIFORM_FLOATS,
} from './styleUniforms';

/**
 * GPU renderer for the 3D lensing mode.
 *
 * Three passes, one canvas:
 *   1. compute  -- `geodesic3d.wgsl`, one thread per texture pixel, writes an
 *      rgba8unorm storage texture sized `scaledTargetSize()` from the current
 *      style's `renderScale` (full resolution for the default preset, quarter
 *      for the retro one);
 *   2. render   -- `blit.wgsl`, nearest-upscales that texture onto the
 *      full-size canvas;
 *   3. render   -- `grid.wgsl`, overlays the Flamm-paraboloid wireframe.
 *
 * The storage texture is recreated whenever the canvas resizes, the scaled
 * size changes or `setStyle()` swaps in a style with a different
 * `renderScale`, because a WebGPU texture has a fixed size and there is no
 * way to scale it in place.
 *
 * Pass 3 is deliberately separate from the ray march: the reference draws the
 * curvature sheet as a translucent overlay in screen space, so it is not
 * lensed. It samples what pass 2 stored and blends on top. Both present
 * passes read the texture through nearest-filtering UVs built straight from
 * @builtin(position), which WebGPU already delivers at the pixel centre
 * (fragCoord = x + 0.5): so `fragCoord * invCanvas` resolves at renderScale 1
 * to the very texel the old textureLoad(vec2<i32>(fragCoord.xy)) truncated
 * to -- byte-identical -- and below 1 texels repeat chunkily. No half pixel
 * is added on top: that would land on the texel boundary and shift by one.
 */

/** Everything the compute shader needs to place a ray. Packed as 4 vec4s. */
export interface CameraState {
  pos: readonly [number, number, number];
  right: readonly [number, number, number];
  up: readonly [number, number, number];
  fwd: readonly [number, number, number];
  /** tan(half of the vertical field of view). */
  tanHalfFov: number;
  /** width / height of the drawing buffer. */
  aspect: number;
}

export interface GpuRenderer {
  /** Re-reads the canvas size, recreating the storage texture if it changed. */
  resize(): void;
  /** Runs the compute pass and presents it. */
  render(camera: CameraState): void;
  /**
   * Applies a presentation style: rewrites the sky, wire and post-flag
   * uniforms, restores the `invCanvas` bytes those builders zero, and
   * re-targets the offscreen texture when `style.renderScale` changes its
   * size. The palette ramp is style-independent and is not rewritten.
   *
   * The renderer never SELECTS a style: no URL, no key binding, no preset
   * name reaches this file. Callers resolve a `Style` (main.ts at startup,
   * lensing3d.ts on `s`/`c`) and hand it over.
   */
  setStyle(style: Style): void;
  /** Reads the storage texture back and reports the width of the black region
   *  along the centre row, in CANVAS pixels -- the texel count converted at
   *  this API's boundary (see `texelsToCanvasPixels`), so it stays comparable
   *  against canvas-pixel arithmetic at any renderScale. Debug aid used to
   *  check the shadow radius against 3√3/2 · rs; returns 0 when no readback
   *  is possible. */
  measureShadowDiameterCanvasPx(): Promise<number>;
  destroy(): void;
}

/** Uniform buffer is exactly 4 x vec4 = 64 bytes. Exported so the
 *  layout-parity test can check the WGSL `Camera` struct against it. */
export const CAMERA_FLOATS = 16;

/** `copyTextureToBuffer` requires bytesPerRow to be a multiple of 256. */
function alignedBytesPerRow(width: number): number {
  const raw = width * 4;
  return Math.ceil(raw / 256) * 256;
}

export async function createGpuRenderer(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
  /** The style to start with. Selection happens in the caller: this renderer
   *  only ever applies what it is handed, now and through `setStyle`. */
  style: Style,
): Promise<GpuRenderer> {
  const context = configureCanvasContext(device, canvas);
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  // WebGPU never throws on a bad shader: the module, the pipeline and every
  // object derived from them become *invalid* and the failure only reaches
  // `uncapturederror`, which needs a console to be useful. An error scope
  // turns it into a thrown Error instead, which main.ts puts on screen --
  // a compile mistake then reads as "WGSL error: line" rather than as a
  // mysteriously black canvas. The scope must open before the first
  // createShaderModule so it is the innermost active scope.
  device.pushErrorScope('validation');
  const geodesicModule = device.createShaderModule({ label: 'geodesic3d', code: geodesicCode });
  const blitModule = device.createShaderModule({ label: 'blit', code: blitCode });
  const gridModule = device.createShaderModule({ label: 'grid', code: gridCode });

  const computePipeline = device.createComputePipeline({
    label: 'geodesic3d',
    layout: 'auto',
    compute: { module: geodesicModule, entryPoint: 'main' },
  });

  const renderPipeline = device.createRenderPipeline({
    label: 'blit',
    layout: 'auto',
    vertex: { module: blitModule, entryPoint: 'vs' },
    fragment: { module: blitModule, entryPoint: 'fs', targets: [{ format: presentationFormat }] },
    primitive: { topology: 'triangle-list' },
  });

  // Alpha blending so the wireframe reads as translucent, exactly the
  // alpha = 0.7 the reference's grid.frag asks for.
  const gridPipeline = device.createRenderPipeline({
    label: 'grid',
    layout: 'auto',
    vertex: {
      module: gridModule,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
        },
      ],
    },
    fragment: {
      module: gridModule,
      entryPoint: 'fs',
      targets: [
        {
          format: presentationFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        },
      ],
    },
    primitive: { topology: 'line-list' },
  });

  const pipelineError = await device.popErrorScope();
  if (pipelineError) {
    throw new Error(`WebGPU pipeline creation failed: ${pipelineError.message}`);
  }

  // Nearest-filtering sampler shared by the blit and grid passes. The
  // fragment position builtin those shaders build their UV from is already
  // the pixel centre, so `fragCoord * invCanvas` points at a texel centre:
  // at renderScale 1 this reads back exactly what the old textureLoad()
  // returned; below 1 it repeats texels for the chunky retro upscale.
  // clamp-to-edge keeps any rounding excursion inside the texture.
  // One sampler serves every resize: filters and address modes are size
  // independent, so it is created once with the pipelines.
  const sourceSampler = device.createSampler({
    label: 'source-nearest',
    magFilter: 'nearest',
    minFilter: 'nearest',
    mipmapFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const cameraBuffer = device.createBuffer({
    size: CAMERA_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Style uniforms: one buffer per consuming pass, sized from the layout
  // tables in styleUniforms.ts (every struct is vec4/vec2 based, so sizes
  // stay multiples of 16 bytes). The style fields are written once from the
  // style this renderer was created with, then only again when setStyle() is
  // called -- there is no per-frame rewriting, because a style is constant
  // between switches. COPY_DST is already in the usage flags, so a switch is
  // just writeBuffer, never a buffer recreation. The wire/post buffers also
  // carry invCanvas, which is canvas data: ensureTargets() and setStyle()
  // both rewrite those 8 bytes at *_INV_CANVAS_OFFSET.
  const skyStyleBuffer = device.createBuffer({
    label: 'sky-style',
    size: SKY_UNIFORM_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const wireStyleBuffer = device.createBuffer({
    label: 'wire-style',
    size: WIRE_UNIFORM_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const postStyleBuffer = device.createBuffer({
    label: 'post-style',
    size: POST_UNIFORM_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // The palette ramp is not preset data: it is the single 12-colour ramp
  // style.ts exports, so it is written once from RETRO_PALETTE and never
  // rewritten -- not even by setStyle(), because both presets share it.
  // Whether blit.wgsl READS it is decided by the palette flag in
  // postStyleBuffer; the buffer itself exists unconditionally so binding 3
  // of the automatic layout is always satisfiable.
  const paletteStyleBuffer = device.createBuffer({
    label: 'palette-style',
    size: PALETTE_UNIFORM_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(skyStyleBuffer, 0, buildSkyStyleUniform(style));
  device.queue.writeBuffer(wireStyleBuffer, 0, buildWireStyleUniform(style));
  device.queue.writeBuffer(postStyleBuffer, 0, buildPostStyleUniform(style));
  device.queue.writeBuffer(paletteStyleBuffer, 0, buildPaletteUniform(RETRO_PALETTE));

  // The stars are static (the reference leaves its N-body pass switched off),
  // so they are uploaded once at creation with mappedAtCreation -- the same
  // treatment the Flamm mesh gets -- and never rewritten.
  const objectsBuffer = device.createBuffer({
    label: 'objects',
    size: STARS.length * STAR_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true,
  });
  new Float32Array(objectsBuffer.getMappedRange()).set(packStars());
  objectsBuffer.unmap();

  // Uploaded with mappedAtCreation so no staging buffer is needed: the mesh
  // is static, built once on the CPU.
  const mesh = buildFlammMesh();
  const gridVertexBuffer = device.createBuffer({
    label: 'grid-vertices',
    size: mesh.positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(gridVertexBuffer.getMappedRange()).set(mesh.positions);
  gridVertexBuffer.unmap();

  const gridIndexBuffer = device.createBuffer({
    label: 'grid-indices',
    size: mesh.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint16Array(gridIndexBuffer.getMappedRange()).set(mesh.indices);
  gridIndexBuffer.unmap();

  // The WGSL `Params` struct is exactly one mat4x4<f32>; sized from the same
  // constant buildViewProjection() produces so the layout-parity test can
  // check the two against each other.
  const gridUniformBuffer = device.createBuffer({
    label: 'grid-view-proj',
    size: VIEW_PROJECTION_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cameraUniforms = new Float32Array(CAMERA_FLOATS);

  let texture: GPUTexture | null = null;
  let computeBindGroup: GPUBindGroup | null = null;
  let blitBindGroup: GPUBindGroup | null = null;
  // Recreated with the other bind groups: it also references the storage
  // texture, which is destroyed and rebuilt on every resize.
  let gridBindGroup: GPUBindGroup | null = null;
  // Canvas backing-store size (full resolution). Drives invCanvas, i.e. the
  // texel-centre UVs the present passes sample with.
  let canvasWidth = 0;
  let canvasHeight = 0;
  // Storage texture size: the canvas at the current style's renderScale.
  // measureShadowDiameterCanvasPx() copies THIS texture, so width/height stay
  // its dimensions and the shadow arithmetic keeps reading pre-post pixels.
  let width = 0;
  let height = 0;
  // Fraction of the canvas the compute pass renders into, owned by the
  // current style: starts at style.renderScale and moves with setStyle().
  // ensureTargets() keys its early return on the size this produces, so a
  // scale change retargets the texture on the next call even when the canvas
  // itself did not move.
  let renderScale = style.renderScale;

  function ensureTargets(): boolean {
    const size = resizeCanvasToDisplaySize(canvas);
    const target = scaledTargetSize(size.width, size.height, renderScale);
    if (
      size.width === canvasWidth &&
      size.height === canvasHeight &&
      target.width === width &&
      target.height === height &&
      texture &&
      computeBindGroup &&
      blitBindGroup &&
      gridBindGroup
    ) {
      return true;
    }

    texture?.destroy();
    canvasWidth = size.width;
    canvasHeight = size.height;
    width = target.width;
    height = target.height;

    // Texel-centre UVs for the two present passes: uv of a canvas pixel is
    // its centre in canvas space. Canvas data, not style data, so it is
    // rewritten whenever the backing store changes -- independently of
    // whichever style fields sit in the same buffers (setStyle() rewrites
    // those, and rewrites invCanvas behind them too).
    const invCanvas = buildInvCanvasUniform(canvasWidth, canvasHeight);
    device.queue.writeBuffer(wireStyleBuffer, WIRE_INV_CANVAS_OFFSET, invCanvas);
    device.queue.writeBuffer(postStyleBuffer, POST_INV_CANVAS_OFFSET, invCanvas);

    texture = device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    const view = texture.createView();
    computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: cameraBuffer } },
        { binding: 1, resource: view },
        { binding: 2, resource: { buffer: objectsBuffer } },
        { binding: 3, resource: { buffer: skyStyleBuffer } },
      ],
    });
    blitBindGroup = device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: view },
        { binding: 1, resource: { buffer: postStyleBuffer } },
        { binding: 2, resource: sourceSampler },
        { binding: 3, resource: { buffer: paletteStyleBuffer } },
      ],
    });
    gridBindGroup = device.createBindGroup({
      layout: gridPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gridUniformBuffer } },
        { binding: 1, resource: view },
        { binding: 2, resource: { buffer: wireStyleBuffer } },
        { binding: 3, resource: sourceSampler },
      ],
    });
    return true;
  }

  function packCamera(camera: CameraState): void {
    cameraUniforms.set(camera.pos, 0);
    cameraUniforms[3] = camera.tanHalfFov;
    cameraUniforms.set(camera.right, 4);
    cameraUniforms[7] = camera.aspect;
    cameraUniforms.set(camera.up, 8);
    cameraUniforms.set(camera.fwd, 12);
  }

  return {
    resize() {
      ensureTargets();
    },

    setStyle(next: Style) {
      // Order matters. Retarget FIRST: it re-reads the canvas, rebuilds the
      // storage texture when the new renderScale changes its size (the
      // early-return keying compares against the target this scale produces)
      // and guarantees canvasWidth/Height are valid for the invCanvas write
      // below -- before the first frame they are still 0.
      renderScale = next.renderScale;
      ensureTargets();

      // Style fields. buildWireStyleUniform()/buildPostStyleUniform() zero
      // the invCanvas slot, so the canvas data living in the same buffers
      // must be rewritten immediately after them.
      device.queue.writeBuffer(skyStyleBuffer, 0, buildSkyStyleUniform(next));
      device.queue.writeBuffer(wireStyleBuffer, 0, buildWireStyleUniform(next));
      device.queue.writeBuffer(postStyleBuffer, 0, buildPostStyleUniform(next));
      const invCanvas = buildInvCanvasUniform(canvasWidth, canvasHeight);
      device.queue.writeBuffer(wireStyleBuffer, WIRE_INV_CANVAS_OFFSET, invCanvas);
      device.queue.writeBuffer(postStyleBuffer, POST_INV_CANVAS_OFFSET, invCanvas);

      // The palette ramp is shared by every preset: intentionally untouched.
    },

    render(camera: CameraState) {
      ensureTargets();
      if (!texture || !computeBindGroup || !blitBindGroup || !gridBindGroup) return;

      packCamera(camera);
      device.queue.writeBuffer(cameraBuffer, 0, cameraUniforms);
      device.queue.writeBuffer(gridUniformBuffer, 0, buildViewProjection(camera));

      const encoder = device.createCommandEncoder();

      const computePass = encoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      // One thread per STORAGE texel: width/height are the scaled texture
      // size, not the canvas, and the shader bounds-checks against
      // textureDimensions(outputTex).
      computePass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      computePass.end();

      // Fetched once and reused: two passes must target the same view, or the
      // overlay would draw onto a different texture than the blit filled.
      const target = context.getCurrentTexture().createView();

      const renderPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: target,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, blitBindGroup);
      renderPass.draw(3);
      renderPass.end();

      // Overlay pass: load what the blit stored, then blend the wireframe on
      // top. No depth attachment, so every line wins -- the reference has no
      // depth test either, which is why the sheet can be drawn over the hole.
      const gridPass = encoder.beginRenderPass({
        colorAttachments: [{ view: target, loadOp: 'load', storeOp: 'store' }],
      });
      gridPass.setPipeline(gridPipeline);
      gridPass.setBindGroup(0, gridBindGroup);
      gridPass.setVertexBuffer(0, gridVertexBuffer);
      gridPass.setIndexBuffer(gridIndexBuffer, 'uint16');
      gridPass.drawIndexed(mesh.indices.length);
      gridPass.end();

      device.queue.submit([encoder.finish()]);
    },

    // The run below is counted in STORAGE TEXELS (the copy reads the
    // pre-post compute texture, whose width is `width`, not the canvas).
    // Only the return converts to canvas pixels -- the unit the self-check
    // arithmetic in lensing3d.ts speaks -- so the classification itself never
    // sees a scaled number.
    async measureShadowDiameterCanvasPx(): Promise<number> {
      if (!texture || !width || !height) return 0;
      const bytesPerRow = alignedBytesPerRow(width);
      const buffer = device.createBuffer({
        size: bytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer(
        { texture },
        { buffer, bytesPerRow, rowsPerImage: height },
        { width, height },
      );
      device.queue.submit([encoder.finish()]);

      try {
        await buffer.mapAsync(GPUMapMode.READ);
        const bytes = new Uint8Array(buffer.getMappedRange());
        const row = Math.floor(height / 2);
        const offset = row * bytesPerRow;
        const at = (x: number, y: number): number[] => {
          const i = y * bytesPerRow + x * 4;
          return [bytes[i], bytes[i + 1], bytes[i + 2]];
        };

        // Maximum channel value anywhere in the frame. Zero means the compute
        // pass never wrote the texture, which is a very different bug from a
        // shadow that is merely too wide -- keep them distinguishable.
        let maxChannel = 0;
        for (let i = 0; i < bytes.length; i += 4) {
          if (bytes[i] > maxChannel) maxChannel = bytes[i];
          if (bytes[i + 1] > maxChannel) maxChannel = bytes[i + 1];
          if (bytes[i + 2] > maxChannel) maxChannel = bytes[i + 2];
        }
        console.log(
          `TEXEL_DEBUG max=${maxChannel} corner=${at(4, 4)} centre=${at(Math.floor(width / 2), row)}`,
        );

        // The shadow is written as pure (0,0,0); the dimmest sky texel still
        // carries blue >= 9 from the base gradient, so the blue channel alone
        // separates them with a wide margin. Testing all three channels would
        // work too but sits one or two codes away from the sky's red channel.
        const isShadow = (i: number): boolean => bytes[i + 2] <= 4;
        const centre = Math.floor(width / 2);
        if (!isShadow(offset + centre * 4)) {
          buffer.unmap();
          buffer.destroy();
          return 0;
        }

        let left = centre;
        while (left > 0 && isShadow(offset + (left - 1) * 4)) left--;
        let right = centre;
        while (right < width - 1 && isShadow(offset + (right + 1) * 4)) right++;

        buffer.unmap();
        buffer.destroy();
        // Texels -> canvas pixels at the API boundary: identity at
        // renderScale 1 (the default style reports exactly what it did when
        // the units were implicit), 4x wider at the retro preset's 0.25.
        return texelsToCanvasPixels(right - left + 1, width, canvasWidth);
      } catch {
        return 0;
      }
    },

    destroy() {
      texture?.destroy();
      cameraBuffer.destroy();
      objectsBuffer.destroy();
      gridVertexBuffer.destroy();
      gridIndexBuffer.destroy();
      gridUniformBuffer.destroy();
      skyStyleBuffer.destroy();
      wireStyleBuffer.destroy();
      postStyleBuffer.destroy();
      paletteStyleBuffer.destroy();
    },
  };
}
