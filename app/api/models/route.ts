import { getAvailableImageModels } from "@/lib/google-genai";

export async function GET() {
  try {
    const result = await getAvailableImageModels();
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load models.";
    return Response.json({ models: [], error: message }, { status: 500 });
  }
}