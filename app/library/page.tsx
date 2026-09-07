import { listLibraryItems } from "@/lib/library-store";
import { LibraryView } from "./library-view";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const items = await listLibraryItems().catch(() => []);

  return <LibraryView initialItems={items} />;
}
