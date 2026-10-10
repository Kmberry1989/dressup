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

export async function handleGenerateLook(request: Request, generate: GenerateImage = generateWithGemini): Promise<Response> {
  try {
    requirePost(request);
    const input = generateLookSchema.parse(await parseJson(request));
    validateImages(input.images);
    const prompt = buildLookPrompt(input);
    const generated = await generate(input, prompt);
    const bytes = Buffer.from(generated.data, 'base64');
    if (!generated.mimeType.startsWith('image/') || bytes.byteLength === 0) {
      throw new ApiError(502, 'INVALID_IMAGE_RESPONSE', 'Gemini returned an invalid image.');
    }
    if (bytes.byteLength > 4_000_000) {
      throw new ApiError(502, 'IMAGE_RESPONSE_TOO_LARGE', 'Gemini returned an image that is too large to deliver. Try another aspect ratio.');
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
