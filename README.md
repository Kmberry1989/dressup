# Cosplay Compass

Cosplay Compass is a standalone AI-powered costume studio. It can create a gala cosplay concept from a written direction and up to two reference portraits, then turn the generated look into a structured shopping guide.

## What works

- Optional JPEG, PNG, or WebP reference portraits with client-side resizing and compression
- Free-by-default generation through Cloudflare Workers AI and FLUX.2 Klein 4B
- Optional higher-quality generation through Gemini 3.1 Flash Lite Image
- Server-side per-session and global rate limiting for the free provider
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
- A free Cloudflare account for the Workers AI provider
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
GEMINI_TEXT_MODEL=gemini-3.8-flash
CLOUDFLARE_WORKER_URL=https://cosplay-compass-image-worker.your-subdomain.workers.dev
CLOUDFLARE_WORKER_SECRET=replace_with_a_random_shared_secret
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

## Deploy the free Cloudflare provider

The Cloudflare Worker uses the native Workers AI binding, FLUX.2 Klein 4B, and two platform rate-limit bindings: three requests per browser session per minute and 24 total requests per minute per Cloudflare location. Cloudflare's own daily free allocation remains the hard account-level ceiling.

```bash
npm run cloudflare:login
npm run cloudflare:deploy
```

Create one random shared secret and store the same value in both places:

```bash
npx wrangler secret put WORKER_SHARED_SECRET --config cloudflare/wrangler.jsonc
vercel env add CLOUDFLARE_WORKER_SECRET
```

Store the deployed Worker URL in Vercel as `CLOUDFLARE_WORKER_URL`, then redeploy the Vercel project. Never expose the shared secret through a `VITE_` variable.

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add `GEMINI_API_KEY`, `CLOUDFLARE_WORKER_URL`, and `CLOUDFLARE_WORKER_SECRET` in Project Settings → Environment Variables.
3. Optionally override `GEMINI_IMAGE_MODEL` or `GEMINI_TEXT_MODEL`.
4. Deploy. Vercel detects the Vite build and deploys the files in `api/` as Node.js Functions.

The frontend compresses each input below 1.1 MB. The server independently validates MIME type, decoded size, pixel dimensions, image count, and aggregate size to remain safely below Vercel's function payload limit.

## API contracts

### `POST /api/generate-look`

Accepts JSON containing `prompt`, `style`, `hair`, `format`, `aspectRatio`, `provider`, `clientId`, and zero to two `{ mimeType, data }` base64 images. Returns image bytes or:

```json
{ "error": { "code": "ERROR_CODE", "message": "Readable explanation" } }
```

### `POST /api/analyze-look`

Accepts a generated image, `priceLevel`, `selectedStores`, and `format`. Returns `{ "items": [...] }` with validated item data and safe Google Shopping search URLs.
