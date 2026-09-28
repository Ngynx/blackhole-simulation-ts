import blitCode from '../shaders/blit.wgsl?raw';
import geodesicCode from '../shaders/geodesic3d.wgsl?raw';
import gridCode from '../shaders/grid.wgsl?raw';
import { buildFlammMesh } from '../physics/flamm';
import { configureCanvasContext, resizeCanvasToDisplaySize } from './webgpu';
import { buildViewProjection } from './viewProjection';

/**
 * GPU renderer for the 3D lensing mode.
 *
 * Three passes, one canvas:
 *   1. compute  -- `geodesic3d.wgsl`, one thread per pixel, writes an
 *      rgba8unorm storage texture;
 *   2. render   -- `blit.wgsl`, copies that texture onto the canvas;
 *   3. render   -- `grid.wgsl`, overlays the Flamm-paraboloid wireframe.
 *
 * The storage texture is recreated whenever the canvas resizes, because a
 * WebGPU texture has a fixed size and there is no way to scale it in place.
 *
 * Pass 3 is deliberately separate from the ray march: the reference draws the
 * curvature sheet as a translucent overlay in screen space, so it is not
 * lensed. It loads what pass 2 stored and blends on top.
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
  /** Reads the storage texture back and reports the width of the black region
   *  along the centre row, in pixels. Debug aid used to check the shadow
   *  radius against 3√3/2 · rs; returns 0 when no readback is possible. */
  measureShadowDiameter(): Promise<number>;
  destroy(): void;
}

/** Uniform buffer is exactly 4 x vec4 = 64 bytes. */
const CAMERA_FLOATS = 16;

/** `copyTextureToBuffer` requires bytesPerRow to be a multiple of 256. */
function alignedBytesPerRow(width: number): number {
  const raw = width * 4;
  return Math.ceil(raw / 256) * 256;
}

export async function createGpuRenderer(
  device: GPUDevice,
  canvas: HTMLCanvasElement,
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

  const cameraBuffer = device.createBuffer({
    size: CAMERA_FLOATS * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

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

  const gridUniformBuffer = device.createBuffer({
    label: 'grid-view-proj',
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const cameraUniforms = new Float32Array(CAMERA_FLOATS);

  let texture: GPUTexture | null = null;
  let computeBindGroup: GPUBindGroup | null = null;
  let blitBindGroup: GPUBindGroup | null = null;
  // Recreated with the other bind groups: it also references the storage
  // texture, which is destroyed and rebuilt on every resize.
  let gridBindGroup: GPUBindGroup | null = null;
  let width = 0;
  let height = 0;

  function ensureTargets(): boolean {
    const size = resizeCanvasToDisplaySize(canvas);
    if (
      size.width === width &&
      size.height === height &&
      texture &&
      computeBindGroup &&
      blitBindGroup &&
      gridBindGroup
    ) {
      return true;
    }

    texture?.destroy();
    width = size.width;
    height = size.height;

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
      ],
    });
    blitBindGroup = device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: view }],
    });
    gridBindGroup = device.createBindGroup({
      layout: gridPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: gridUniformBuffer } },
        { binding: 1, resource: view },
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

    async measureShadowDiameter(): Promise<number> {
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
        return right - left + 1;
      } catch {
        return 0;
      }
    },

    destroy() {
      texture?.destroy();
      cameraBuffer.destroy();
      gridVertexBuffer.destroy();
      gridIndexBuffer.destroy();
      gridUniformBuffer.destroy();
    },
  };
}
