import { imageSize } from 'image-size';
import { z } from 'zod';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 1_250_000;
export const MAX_TOTAL_IMAGE_BYTES = 2_500_000;
export const MAX_IMAGE_DIMENSION = 2048;

const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;

export const inlineImageSchema = z.object({
  mimeType: z.enum(ALLOWED_IMAGE_TYPES),
  data: z.string().min(16).max(2_000_000).regex(base64Pattern, 'Invalid base64 image data'),
});

export const generateLookSchema = z.object({
  prompt: z.string().trim().min(10).max(2_000),
  style: z.string().trim().min(1).max(100),
  hair: z.string().trim().min(1).max(100),
  format: z.enum(['Portrait', 'Spread']),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']),
  provider: z.enum(['cloudflare', 'gemini']).default('cloudflare'),
  designMode: z.enum(['original', 'match-partner']).default('original'),
  clientId: z.string().uuid().optional(),
  images: z.array(inlineImageSchema).max(2),
}).superRefine((input, context) => {
  if (input.designMode === 'match-partner' && input.images.length === 0) {
    context.addIssue({
      code: 'custom',
      path: ['images'],
      message: 'Add a photo of the partner dress before generating a matching tux.',
    });
  }
});

export const analyzeLookSchema = z.object({
  image: inlineImageSchema,
  priceLevel: z.enum(['Budget', 'Standard', 'Premium']),
  selectedStores: z.array(z.string().trim().min(1).max(100)).max(50),
  format: z.enum(['Portrait', 'Spread']),
});

export const cosplayItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  searchQuery: z.string().trim().min(1).max(240),
  estimatedPrice: z.string().trim().max(80).optional(),
  material: z.string().trim().max(160).optional(),
  recommendedStore: z.string().trim().max(100).optional(),
});

export const cosplayItemsSchema = z.array(cosplayItemSchema).min(1).max(12);

export type InlineImage = z.infer<typeof inlineImageSchema>;
export type GenerateLookInput = z.infer<typeof generateLookSchema>;
export type AnalyzeLookInput = z.infer<typeof analyzeLookSchema>;
export type AnalyzedItem = z.infer<typeof cosplayItemSchema>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      { error: { code: 'INVALID_REQUEST', message: error.issues[0]?.message ?? 'The request was invalid.' } },
      { status: 400 },
    );
  }
  const providerStatus = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
  const providerMessage = error instanceof Error ? error.message : '';
  if (providerStatus === 429 && providerMessage.includes('limit: 0') && providerMessage.includes('image')) {
    console.error('Gemini image generation requires paid quota', error);
    return Response.json(
      {
        error: {
          code: 'GEMINI_IMAGE_BILLING_REQUIRED',
          message: 'Gemini image generation is not available on the free tier. Enable billing for this Google AI project, then try again.',
        },
      },
      { status: 429 },
    );
  }
  if (providerStatus === 429) {
    console.error('Gemini quota exceeded', error);
    return Response.json(
      { error: { code: 'GEMINI_QUOTA_EXCEEDED', message: 'Gemini is temporarily rate-limited. Wait a moment, then try again.' } },
      { status: 429 },
    );
  }
  if (providerStatus === 503) {
    console.error('Gemini service temporarily unavailable', error);
    return Response.json(
      { error: { code: 'GEMINI_UNAVAILABLE', message: 'Shopping analysis is temporarily busy. Wait a moment, then try again.' } },
      { status: 503 },
    );
  }
  console.error('Image provider request failed', error);
  return Response.json(
    { error: { code: 'PROVIDER_ERROR', message: 'The image provider could not complete this request. Please try again.' } },
    { status: 502 },
  );
}

export function requirePost(request: Request): void {
  if (request.method !== 'POST') throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.');
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send an application/json request.');
  }
}

export async function parseJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > 4_000_000) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.');
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
}

export function validateImages(images: InlineImage[]): void {
  let total = 0;
  for (const image of images) {
    const bytes = Buffer.from(image.data, 'base64');
    total += bytes.byteLength;
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ApiError(413, 'IMAGE_TOO_LARGE', 'Each image must be 1.25 MB or smaller after processing.');
    }
    const dimensions = imageSize(bytes);
    if (!dimensions.width || !dimensions.height || dimensions.width > MAX_IMAGE_DIMENSION || dimensions.height > MAX_IMAGE_DIMENSION) {
      throw new ApiError(400, 'INVALID_DIMENSIONS', 'Images must be no larger than 2048 pixels on either side.');
    }
  }
  if (total > MAX_TOTAL_IMAGE_BYTES) {
    throw new ApiError(413, 'IMAGES_TOO_LARGE', 'The combined image payload must be 2.5 MB or smaller.');
  }
}

export function buildLookPrompt(input: GenerateLookInput): string {
  const sections = [input.prompt];
  if (input.designMode === 'match-partner') {
    sections.unshift('Generate ONLY a solo adult man wearing a complete formal tuxedo look. The first reference image is his partner\'s already-selected dress: analyze its exact color family, undertone, fabric sheen, embellishment, formality, and visual era, then design a complementary tuxedo that coordinates without copying or competing with it. Do not show the partner, the dress, a woman, a couple, or a split-screen comparison in the output. If a second reference image is present, use it only to preserve the man\'s recognizable features. Show the tux clearly enough to shop every component.');
  } else if (input.images.length === 2) sections.unshift('Create a coordinated power-couple portrait using both reference subjects.');
  else if (input.images.length === 1) sections.unshift('Preserve the recognizable features of the adult subject in the reference image.');
  if (input.format === 'Spread') {
    sections.unshift('Create a cohesive three-panel editorial spread: full-body look, fabric detail, and accessories detail.');
  }
  if (input.style !== 'None') sections.push(`Attire direction: ${input.style}.`);
  if (input.hair !== 'Original / No Change') sections.push(`Hair and grooming direction: ${input.hair}.`);
  sections.push('Show adult subjects only. High-fashion gala styling, tasteful coverage, photorealistic textiles, editorial lighting.');
  return sections.join(' ');
}

export function buildShoppingUrl(query: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query.trim())}`;
}

export function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new ApiError(503, 'GEMINI_NOT_CONFIGURED', 'Gemini is not configured yet. Add GEMINI_API_KEY on the server.');
  return key;
}
