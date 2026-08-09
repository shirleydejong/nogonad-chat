import { promises as fs } from "fs";
import path from "path";

export type LibraryItem = {
  id: string;
  prompt: string;
  model: string;
  mode: "generate" | "edit";
  aspectRatio: string;
  imageSize: string;
  createdAt: string;
  fileName: string;
  referenceCount: number;
  mimeType: string;
};

type LibraryManifest = {
  items: LibraryItem[];
};

const STORAGE_ROOT = path.join(process.cwd(), "storage", "library");
const MANIFEST_PATH = path.join(STORAGE_ROOT, "manifest.json");

async function ensureStorage() {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

async function readManifest(): Promise<LibraryManifest> {
  await ensureStorage();

  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    const parsed = JSON.parse(raw) as LibraryManifest;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { items: [] };
  }
}

async function writeManifest(manifest: LibraryManifest) {
  await ensureStorage();
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

export async function listLibraryItems() {
  const manifest = await readManifest();
  return manifest.items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getLibraryItem(id: string) {
  const manifest = await readManifest();
  return manifest.items.find((item) => item.id === id) ?? null;
}

export async function getLibraryImagePath(id: string) {
  const item = await getLibraryItem(id);
  if (!item) {
    return null;
  }

  return path.join(STORAGE_ROOT, item.fileName);
}

export async function saveLibraryImage(input: {
  id: string;
  prompt: string;
  model: string;
  mode: "generate" | "edit";
  aspectRatio: string;
  imageSize: string;
  bytes: Buffer;
  referenceCount: number;
  mimeType?: string;
}) {
  const manifest = await readManifest();
  const fileName = `${input.id}.png`;

  await fs.writeFile(path.join(STORAGE_ROOT, fileName), input.bytes);

  const nextItem: LibraryItem = {
    id: input.id,
    prompt: input.prompt,
    model: input.model,
    mode: input.mode,
    aspectRatio: input.aspectRatio,
    imageSize: input.imageSize,
    createdAt: new Date().toISOString(),
    fileName,
    referenceCount: input.referenceCount,
    mimeType: input.mimeType ?? "image/png",
  };

  manifest.items.unshift(nextItem);
  await writeManifest(manifest);

  return nextItem;
}

export async function deleteLibraryItem(id: string) {
  const manifest = await readManifest();
  const item = manifest.items.find((entry) => entry.id === id);

  if (!item) {
    return false;
  }

  manifest.items = manifest.items.filter((entry) => entry.id !== id);
  await writeManifest(manifest);

  try {
    await fs.unlink(path.join(STORAGE_ROOT, item.fileName));
  } catch {
    // Ignore missing files; the manifest is the source of truth.
  }

  return true;
}

export async function readLibraryImageBuffer(id: string) {
  const imagePath = await getLibraryImagePath(id);
  if (!imagePath) {
    return null;
  }

  return fs.readFile(imagePath);
}