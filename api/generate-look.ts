import { GoogleGenAI, Modality } from '@google/genai';
import {
  ApiError,
  buildLookPrompt,
  errorResponse,
  generateLookSchema,
  getApiKey,
  parseJson,
  requirePost,
  validateImages,
  type GenerateLookInput,
} from './_shared.js';

export interface GeneratedImageResult {
  data: string;
  mimeType: string;
  model: string;
}

export type GenerateImage = (input: GenerateLookInput, prompt: string) => Promise<GeneratedImageResult>;

const CLOUDFLARE_DIMENSIONS: Record<GenerateLookInput['aspectRatio'], [number, number]> = {
  '1:1': [1024, 1024],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
};

export const generateWithGemini: GenerateImage = async (input, prompt) => {
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-lite-image';
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        ...input.images.map((image) => ({ inlineData: { data: image.data, mimeType: image.mimeType } })),
        { text: prompt },
      ],
    }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      imageConfig: {
        aspectRatio: input.format === 'Spread' ? '3:4' : input.aspectRatio,
        imageSize: '1K',
      },
    },
  });

  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/')) {
        return { data: part.inlineData.data, mimeType: part.inlineData.mimeType, model };
      }
    }
  }
  throw new ApiError(502, 'NO_IMAGE_RETURNED', 'Gemini completed without returning an image. Try a different prompt.');
};

export const generateWithCloudflare: GenerateImage = async (input, prompt) => {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL?.trim();
  const workerSecret = process.env.CLOUDFLARE_WORKER_SECRET?.trim();
  if (!workerUrl || !workerSecret) {
    throw new ApiError(503, 'CLOUDFLARE_NOT_CONFIGURED', 'Free generation is still being configured. Choose Higher Quality or try again later.');
  }
  if (!input.clientId) throw new ApiError(400, 'CLIENT_ID_REQUIRED', 'Refresh the page before using free generation.');
  const [width, height] = input.format === 'Spread' ? CLOUDFLARE_DIMENSIONS['3:4'] : CLOUDFLARE_DIMENSIONS[input.aspectRatio];
  const response = await fetch(new URL('/generate', workerUrl).toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${workerSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, width, height, clientId: input.clientId, images: input.images }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      response.status,
      payload?.error?.code || 'CLOUDFLARE_ERROR',
      payload?.error?.message || 'The free image provider could not complete this request.',
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    data: bytes.toString('base64'),
    mimeType: response.headers.get('content-type') || 'image/png',
    model: response.headers.get('x-cosplay-model') || '@cf/black-forest-labs/flux-2-klein-4b',
  };
};

export const generateWithSelectedProvider: GenerateImage = (input, prompt) => (
  input.provider === 'gemini' ? generateWithGemini(input, prompt) : generateWithCloudflare(input, prompt)
);

export async function handleGenerateLook(request: Request, generate: GenerateImage = generateWithSelectedProvider): Promise<Response> {
  try {
    requirePost(request);
    const input = generateLookSchema.parse(await parseJson(request));
    validateImages(input.images);
    const prompt = buildLookPrompt(input);
    const generated = await generate(input, prompt);
    const bytes = Buffer.from(generated.data, 'base64');
    if (!generated.mimeType.startsWith('image/') || bytes.byteLength === 0) {
      throw new ApiError(502, 'INVALID_IMAGE_RESPONSE', 'The image provider returned an invalid image.');
    }
    if (bytes.byteLength > 4_000_000) {
      throw new ApiError(502, 'IMAGE_RESPONSE_TOO_LARGE', 'The image provider returned an image that is too large to deliver. Try another aspect ratio.');
    }
    return new Response(bytes, {
      headers: {
        'Content-Type': generated.mimeType,
        'Cache-Control': 'no-store',
        'X-Cosplay-Model': generated.model,
        'X-Cosplay-Prompt': encodeURIComponent(prompt.slice(0, 1_800)),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export function POST(request: Request): Promise<Response> {
  return handleGenerateLook(request);
}
