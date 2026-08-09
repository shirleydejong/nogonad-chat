import { ImageStudio } from "./studio";
import { getAvailableImageModels } from "@/lib/google-genai";
import { listLibraryItems } from "@/lib/library-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [modelsResult, libraryItems] = await Promise.all([
    getAvailableImageModels().catch((error) => ({
      models: [],
      error: error instanceof Error ? error.message : "Model list could not be loaded.",
    })),
    listLibraryItems().catch(() => []),
  ]);
  const modelError = "error" in modelsResult ? modelsResult.error : undefined;

  return (
    <main className="min-h-screen">
      <ImageStudio
        initialModels={modelsResult.models}
        initialModelError={modelError}
        initialLibraryItems={libraryItems}
      />
    </main>
  );
}
