type WorkerEnv = Env & {
  WORKER_SHARED_SECRET: string;
};

interface WorkerImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
}

interface GenerateBody {
  prompt: string;
  width: number;
  height: number;
  clientId: string;
  images: WorkerImage[];
}

const MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function decodeBase64(data: string): ArrayBuffer {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function detectImageMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp';
  return null;
}

async function verifyToken(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
  };
  const [providedHash, expectedHash] = await Promise.all([
    subtle.digest('SHA-256', encoder.encode(provided)),
    subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return subtle.timingSafeEqual(providedHash, expectedHash);
}

function validBody(value: unknown): value is GenerateBody {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<GenerateBody>;
  return typeof body.prompt === 'string'
    && body.prompt.length >= 10
    && body.prompt.length <= 3_000
    && typeof body.clientId === 'string'
    && body.clientId.length <= 100
    && Number.isInteger(body.width)
    && Number.isInteger(body.height)
    && Number(body.width) >= 256
    && Number(body.width) <= 1920
    && Number(body.height) >= 256
    && Number(body.height) <= 1920
    && Array.isArray(body.images)
    && body.images.length <= 2
    && body.images.every((image) => ALLOWED_TYPES.has(image.mimeType) && typeof image.data === 'string' && image.data.length <= 2_000_000);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/generate') return jsonError(404, 'NOT_FOUND', 'Not found.');
    const providedAuthorization = request.headers.get('authorization') ?? '';
    const expectedAuthorization = `Bearer ${env.WORKER_SHARED_SECRET ?? ''}`;
    if (!env.WORKER_SHARED_SECRET || !(await verifyToken(providedAuthorization, expectedAuthorization))) {
      console.error(JSON.stringify({
        message: 'Worker authorization failed',
        hasConfiguredSecret: Boolean(env.WORKER_SHARED_SECRET),
        providedLength: providedAuthorization.length,
        expectedLength: expectedAuthorization.length,
      }));
      return jsonError(401, 'UNAUTHORIZED', 'Unauthorized.');
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
    }
    if (!validBody(rawBody)) return jsonError(400, 'INVALID_REQUEST', 'The generation request is invalid.');

    const [userLimit, globalLimit] = await Promise.all([
      env.USER_RATE_LIMITER.limit({ key: rawBody.clientId }),
      env.GLOBAL_RATE_LIMITER.limit({ key: 'cosplay-compass-free-generation' }),
    ]);
    if (!userLimit.success) return jsonError(429, 'USER_RATE_LIMIT', 'Free generation is limited to three requests per minute. Please wait and try again.');
    if (!globalLimit.success) return jsonError(429, 'GLOBAL_RATE_LIMIT', 'The free generator is busy. Please wait a minute and try again.');

    const form = new FormData();
    form.set('prompt', rawBody.prompt);
    form.set('width', String(rawBody.width));
    form.set('height', String(rawBody.height));
    form.set('guidance', '4');
    rawBody.images.forEach((image, index) => {
      form.set(`input_image_${index}`, new Blob([decodeBase64(image.data)], { type: image.mimeType }), `reference-${index}`);
    });
    const formRequest = new Request('https://worker.internal/generate', { method: 'POST', body: form });
    const formStream = formRequest.body;
    if (!formStream) return jsonError(500, 'FORM_ENCODING_FAILED', 'The image request could not be encoded.');
    try {
      const response = await env.AI.run(MODEL, {
        multipart: {
          body: formStream,
          contentType: formRequest.headers.get('content-type') ?? 'multipart/form-data',
        },
      });
      if (typeof response.image !== 'string') {
        console.error(JSON.stringify({ message: 'Workers AI returned no image', model: MODEL }));
        return jsonError(502, 'NO_IMAGE_RETURNED', 'Cloudflare completed without returning an image.');
      }
      const imageBytes = new Uint8Array(decodeBase64(response.image));
      const mimeType = detectImageMime(imageBytes);
      if (!mimeType) {
        console.error(JSON.stringify({ message: 'Workers AI returned an unsupported image format', model: MODEL }));
        return jsonError(502, 'INVALID_IMAGE_RETURNED', 'Cloudflare returned an unsupported image format.');
      }
      console.log(JSON.stringify({ message: 'Image generated', model: MODEL, references: rawBody.images.length }));
      return new Response(imageBytes, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-store',
          'X-Cosplay-Model': MODEL,
        },
      });
    } catch (error) {
      console.error(JSON.stringify({
        message: 'Workers AI generation failed',
        model: MODEL,
        error: error instanceof Error ? error.message : String(error),
      }));
      return jsonError(502, 'CLOUDFLARE_AI_ERROR', 'Cloudflare could not generate this image. Please try again.');
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
