import { deleteLibraryItem, getLibraryItem } from "@/lib/library-store";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getLibraryItem(id);

  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json({ item });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteLibraryItem(id);

  if (!deleted) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, { status: 204 });
}