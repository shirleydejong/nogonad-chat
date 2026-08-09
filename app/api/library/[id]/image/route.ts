import { readLibraryImageBuffer } from "@/lib/library-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await readLibraryImageBuffer(id);

  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(image, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
    },
  });
}