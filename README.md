# Nano Banana Image Studio

A focused image generation and editing web app built with Next.js and Google GenAI.

This project is intentionally **vibe-coded**: fast iteration, practical UX choices, and direct product-first implementation.

## What This App Does

- Generates images using a fixed Nano Banana model set.
- Supports image editing with:
	- a required base image
	- optional reference images
	- optional mask image
- Stores generated results in a persistent server-side library.
- Supports deleting images from the library.
- Keeps your latest prompt, model, aspect ratio, and image size in session storage.

## Fixed Model List

The model picker is intentionally fixed to:

- `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite)
- `gemini-3.1-flash-image` (Nano Banana 2)
- `gemini-3-pro-image` (Nano Banana Pro)

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- `@google/genai`

## Environment Variables

Create a `.env.local` file in the project root:

```env
GOOGLE_API_KEY=your_google_api_key
```

The app also supports:

- `GEMINI_API_KEY`
- `GOOGLE_GENAI_API_KEY`

## Local Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

The default dev port in this project is `5010`.

## Production Build

```bash
npm run build
npm run start
```

## Project Structure

- `app/page.tsx` - server entry that hydrates initial model/library data
- `app/studio.tsx` - main client UI
- `app/api/generate/route.ts` - generation and edit endpoint
- `app/api/models/route.ts` - model list endpoint
- `app/api/library/**` - library metadata/image/delete endpoints
- `lib/google-genai.ts` - GenAI client + model config
- `lib/library-store.ts` - server filesystem storage for the image library

## Notes

- Output is stored as PNG in the app library.
- The app is currently single-user and uses filesystem persistence.
- This is a focused image workflow app, not a general chat assistant.

## Disclaimer

Model behavior and availability can change over time. If Google deprecates or renames model IDs, update the fixed list in `lib/google-genai.ts`.
