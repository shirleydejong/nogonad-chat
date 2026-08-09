import { listLibraryItems } from "@/lib/library-store";

export async function GET() {
  const items = await listLibraryItems();
  return Response.json({ items });
}