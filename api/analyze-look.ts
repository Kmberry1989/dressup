import { GoogleGenAI } from '@google/genai';
import {
  analyzeLookSchema,
  ApiError,
  buildShoppingUrl,
  cosplayItemsSchema,
  errorResponse,
  getApiKey,
  parseJson,
  requirePost,
  validateImages,
  type AnalyzeLookInput,
  type AnalyzedItem,
} from './_shared.js';

const itemJsonSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 12,
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      searchQuery: { type: 'string' },
      estimatedPrice: { type: 'string' },
      material: { type: 'string' },
      recommendedStore: { type: 'string' },
    },
    required: ['name', 'description', 'searchQuery'],
  },
};

export type AnalyzeImage = (input: AnalyzeLookInput) => Promise<unknown>;

export const analyzeWithGemini: AnalyzeImage = async (input) => {
  const model = process.env.GEMINI_TEXT_MODEL?.trim() || 'gemini-3.8-flash';
  const selectedStores = input.selectedStores.length
    ? `Recommend only from this allowed store list when possible: ${input.selectedStores.join(', ')}.`
    : 'Use broadly available retailers.';
  const detailDirection = input.format === 'Spread'
    ? 'Use the visible detail panels to identify specific fabrics and accessories.'
    : 'Identify the complete visible outfit from the portrait.';
  const prompt = `Create a practical shopping breakdown for this gala cosplay look at the ${input.priceLevel} price tier. ${detailDirection} ${selectedStores} Include clothing, footwear, accessories, materials, and grooming only when visibly relevant. Prices are estimates. Never return URLs. Return concise search-ready item names and queries.`;

  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { data: input.image.data, mimeType: input.image.mimeType } },
        { text: prompt },
      ],
    }],
    config: {
      systemInstruction: 'You are a careful costume sourcing assistant. Describe what is visible and avoid asserting brand authenticity.',
      responseMimeType: 'application/json',
      responseJsonSchema: itemJsonSchema,
      temperature: 0.2,
    },
  });
  if (!response.text) throw new ApiError(502, 'NO_ANALYSIS_RETURNED', 'Gemini returned no shopping analysis.');
  try {
    return JSON.parse(response.text);
  } catch {
    throw new ApiError(502, 'INVALID_ANALYSIS_RESPONSE', 'Gemini returned malformed shopping data.');
  }
};

export async function handleAnalyzeLook(request: Request, analyze: AnalyzeImage = analyzeWithGemini): Promise<Response> {
  try {
    requirePost(request);
    const input = analyzeLookSchema.parse(await parseJson(request));
    validateImages([input.image]);
    const parsedItems = cosplayItemsSchema.safeParse(await analyze(input));
    if (!parsedItems.success) {
      throw new ApiError(502, 'INVALID_ANALYSIS_RESPONSE', 'Gemini returned shopping data in an unexpected format.');
    }
    const items = parsedItems.data.map((item: AnalyzedItem) => ({
      ...item,
      shopUrl: buildShoppingUrl(item.searchQuery),
    }));
    return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export function POST(request: Request): Promise<Response> {
  return handleAnalyzeLook(request);
}
