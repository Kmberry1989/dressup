import type { CosplayItem, GeneratedLook, ImageProvider, LookFormat, PriceLevel, UserImage } from '../types';

// FLUX.2 Klein requires each reference edge to be smaller than 512 pixels.
const MAX_EDGE = 511;
const MAX_ENCODED_BYTES = 1_100_000;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class ClientError extends Error {}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ClientError('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new ClientError('The image could not be processed.')),
      'image/jpeg',
      quality,
    );
  });
}

export async function prepareImage(file: Blob, originalType = file.type): Promise<Omit<UserImage, 'id' | 'previewUrl'>> {
  if (!SUPPORTED_TYPES.has(originalType)) throw new ClientError('Choose a JPEG, PNG, or WebP image.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ClientError('Your browser cannot process this image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let output = await canvasToBlob(canvas, 0.88);
  for (const quality of [0.76, 0.64, 0.52]) {
    if (output.size <= MAX_ENCODED_BYTES) break;
    output = await canvasToBlob(canvas, quality);
  }
  if (output.size > MAX_ENCODED_BYTES) throw new ClientError('This image is still too large after compression. Try a smaller file.');
  const dataUrl = await readAsDataUrl(output);
  return { data: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg', width, height };
}

async function responseError(response: Response): Promise<ClientError> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new ClientError(payload.error?.message || `The request failed (${response.status}).`);
  } catch {
    return new ClientError(`The request failed (${response.status}).`);
  }
}

export interface GenerateLookRequest {
  prompt: string;
  style: string;
  hair: string;
  format: LookFormat;
  aspectRatio: string;
  provider: ImageProvider;
  clientId: string;
  images: UserImage[];
}

export async function requestGeneratedLook(input: GenerateLookRequest, signal?: AbortSignal): Promise<Omit<GeneratedLook, 'id' | 'imageUrl' | 'timestamp'>> {
  const response = await fetch('/api/generate-look', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, images: input.images.map(({ data, mimeType }) => ({ data, mimeType })) }),
    signal,
  });
  if (!response.ok) throw await responseError(response);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/') || blob.size === 0) throw new ClientError('The server did not return a usable image.');
  const headerPrompt = response.headers.get('X-Cosplay-Prompt');
  return {
    blob,
    mimeType: blob.type,
    prompt: headerPrompt ? decodeURIComponent(headerPrompt) : input.prompt,
    isSpread: input.format === 'Spread',
  };
}

export async function requestLookAnalysis(
  look: GeneratedLook,
  priceLevel: PriceLevel,
  selectedStores: string[],
  format: LookFormat,
  signal?: AbortSignal,
): Promise<CosplayItem[]> {
  const prepared = await prepareImage(look.blob, look.mimeType);
  const response = await fetch('/api/analyze-look', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: { data: prepared.data, mimeType: prepared.mimeType }, priceLevel, selectedStores, format }),
    signal,
  });
  if (!response.ok) throw await responseError(response);
  const payload = await response.json() as { items?: CosplayItem[] };
  if (!Array.isArray(payload.items)) throw new ClientError('The shopping breakdown was not valid.');
  return payload.items;
}
