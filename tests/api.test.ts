import { describe, expect, it, vi } from 'vitest';
import { handleAnalyzeLook } from '../api/analyze-look';
import { buildShoppingUrl, errorResponse } from '../api/_shared';
import { handleGenerateLook } from '../api/generate-look';

const pixel = {
  mimeType: 'image/png' as const,
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
};

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function generationBody(images: Array<{ mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }> = []) {
  return {
    prompt: 'Create an elegant celestial gala costume with sculptural tailoring.',
    style: 'Celestial Couture',
    hair: 'Hollywood Waves',
    format: 'Portrait',
    aspectRatio: '9:16',
    images,
  };
}

describe('generate-look API', () => {
  it.each([0, 1, 2])('accepts %i reference images and returns binary output', async (count) => {
    const generate = vi.fn().mockResolvedValue({ ...pixel, model: 'mock-image-model' });
    const response = await handleGenerateLook(jsonRequest('/api/generate-look', generationBody(Array(count).fill(pixel))), generate);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('X-Cosplay-Model')).toBe('mock-image-model');
    expect(generate).toHaveBeenCalledOnce();
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it('rejects oversized decoded images', async () => {
    const oversized = { mimeType: 'image/jpeg' as const, data: Buffer.alloc(1_300_000, 1).toString('base64') };
    const response = await handleGenerateLook(jsonRequest('/api/generate-look', generationBody([oversized])), vi.fn());
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'IMAGE_TOO_LARGE' } });
  });

  it('returns a stable provider error without leaking internals', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    const response = await handleGenerateLook(
      jsonRequest('/api/generate-look', generationBody()),
      vi.fn().mockRejectedValue(new Error('secret provider detail')),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'PROVIDER_ERROR', message: 'The image provider could not complete this request. Please try again.' },
    });
  });

  it('routes free generation through the configured Cloudflare worker', async () => {
    process.env.CLOUDFLARE_WORKER_URL = 'https://free.example.workers.dev';
    process.env.CLOUDFLARE_WORKER_SECRET = 'test-secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from(pixel.data, 'base64'), {
      headers: { 'Content-Type': 'image/png', 'X-Cosplay-Model': 'mock-cloudflare-model' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const response = await handleGenerateLook(jsonRequest('/api/generate-look', {
        ...generationBody(),
        provider: 'cloudflare',
        clientId: 'd9428888-122b-11e1-b85c-61cd3cbb3210',
      }));
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Cosplay-Model')).toBe('mock-cloudflare-model');
      expect(fetchMock).toHaveBeenCalledWith('https://free.example.workers.dev/generate', expect.objectContaining({ method: 'POST' }));
    } finally {
      vi.unstubAllGlobals();
      delete process.env.CLOUDFLARE_WORKER_URL;
      delete process.env.CLOUDFLARE_WORKER_SECRET;
    }
  });

  it('explains when Gemini image generation needs paid quota', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    const providerError = Object.assign(
      new Error('Quota exceeded. limit: 0, model: gemini-3.1-flash-image'),
      { status: 429 },
    );
    const response = await handleGenerateLook(
      jsonRequest('/api/generate-look', generationBody()),
      vi.fn().mockRejectedValue(providerError),
    );
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'GEMINI_IMAGE_BILLING_REQUIRED',
        message: 'Gemini image generation is not available on the free tier. Enable billing for this Google AI project, then try again.',
      },
    });
  });
});

describe('analyze-look API', () => {
  const body = { image: pixel, priceLevel: 'Standard', selectedStores: ['Etsy'], format: 'Portrait' };

  it('validates model data and adds an application-owned shopping URL', async () => {
    const analyze = vi.fn().mockResolvedValue([{ name: 'Gold cape', description: 'A structured metallic cape.', searchQuery: 'structured gold cosplay cape', recommendedStore: 'Etsy' }]);
    const response = await handleAnalyzeLook(jsonRequest('/api/analyze-look', body), analyze);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ name: 'Gold cape', shopUrl: buildShoppingUrl('structured gold cosplay cape') }],
    });
  });

  it('maps malformed provider output to a provider response error', async () => {
    const response = await handleAnalyzeLook(jsonRequest('/api/analyze-look', body), vi.fn().mockResolvedValue([{ name: '' }]));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'INVALID_ANALYSIS_RESPONSE' } });
  });
});

describe('shopping URL safety', () => {
  it('always points at an encoded Google Shopping search', () => {
    expect(buildShoppingUrl('cape & crown')).toBe('https://www.google.com/search?tbm=shop&q=cape%20%26%20crown');
  });
});

describe('provider availability errors', () => {
  it('returns an actionable 503 when Gemini is temporarily unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    const response = errorResponse(Object.assign(new Error('high demand'), { status: 503 }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'GEMINI_UNAVAILABLE',
        message: 'Shopping analysis is temporarily busy. Wait a moment, then try again.',
      },
    });
  });
});
