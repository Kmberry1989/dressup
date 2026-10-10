# Cosplay Compass

Cosplay Compass is a standalone Gemini-powered costume studio. It can create a gala cosplay concept from a written direction and up to two reference portraits, then turn the generated look into a structured shopping guide.

## What works

- Optional JPEG, PNG, or WebP reference portraits with client-side resizing and compression
- Still-image generation through Gemini 3.1 Flash Image
- Portrait and three-panel editorial-spread formats
- Budget, store, styling, hair, and aspect-ratio controls
- Gemini shopping analysis with validated structured output
- Application-owned Google Shopping links instead of model-generated URLs
- Session-local look history and browser downloads
- Responsive desktop and mobile workspaces

Runway video is intentionally not part of version one.

## Requirements

- Node.js 22 or newer
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- The Vercel CLI, which `npm run dev` will offer to run through `npx`

## Local setup

```bash
npm install
cp .env.example .env.local
```

Add your real key to `.env.local`:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_IMAGE_MODEL=gemini-3.1-flash-lite-image
GEMINI_TEXT_MODEL=gemini-2.5-flash
```

Do not prefix the key with `VITE_`; that would expose it to the browser. Real `.env` files are ignored by Git.

Start the complete app, including local Vercel Functions:

```bash
npm run dev:full
```

Use `npm run dev` when working on the frontend without API calls. Keeping Vite as the base `dev` command prevents Vercel CLI from recursively invoking itself.

## Verification

```bash
npm test
npm run build
```

The API test suite injects mock Gemini adapters, so it is deterministic and does not spend API quota. A real key is required to verify live generation and analysis.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add `GEMINI_API_KEY` in Project Settings → Environment Variables.
3. Optionally override `GEMINI_IMAGE_MODEL` or `GEMINI_TEXT_MODEL`.
4. Deploy. Vercel detects the Vite build and deploys the files in `api/` as Node.js Functions.

The frontend compresses each input below 1.1 MB. The server independently validates MIME type, decoded size, pixel dimensions, image count, and aggregate size to remain safely below Vercel's function payload limit.

## API contracts

### `POST /api/generate-look`

Accepts JSON containing `prompt`, `style`, `hair`, `format`, `aspectRatio`, and zero to two `{ mimeType, data }` base64 images. Returns image bytes or:

```json
{ "error": { "code": "ERROR_CODE", "message": "Readable explanation" } }
```

### `POST /api/analyze-look`

Accepts a generated image, `priceLevel`, `selectedStores`, and `format`. Returns `{ "items": [...] }` with validated item data and safe Google Shopping search URLs.
