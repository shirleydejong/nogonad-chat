"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { LibraryItem } from "@/lib/library-store";
import { ImageLightbox } from "@/app/components/image-lightbox";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type LibraryViewProps = {
  initialItems: LibraryItem[];
};

export function LibraryView({ initialItems }: LibraryViewProps) {
  const [items, setItems] = useState(initialItems);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [addingUploadIds, setAddingUploadIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function addLibraryItemAsUpload(item: LibraryItem) {
    const params = new URLSearchParams({ "add-upload": item.id });
    window.location.assign(`/?${params.toString()}`);
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Weet je zeker dat je deze afbeelding wilt verwijderen?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/library/${id}`, { method: "DELETE" });

    if (!response.ok && response.status !== 204) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Delete failed.");
      return;
    }

    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    setLightboxIndex((currentIndex) => {
      if (currentIndex === null) {
        return null;
      }

      const nextItems = items.filter((item) => item.id !== id);
      const nextTarget = Math.min(currentIndex, Math.max(nextItems.length - 1, 0));
      if (nextItems.length === 0) {
        return null;
      }
      return nextTarget;
    });
  }

  const lightboxItems = items.map((item) => ({
    id: item.id,
    prompt: item.prompt,
    imageUrl: `/api/library/${item.id}/image`,
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <header className="rounded-[24px] border border-white/10 bg-[color:var(--panel)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Library</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Generated image history</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
            >
              Back to studio
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold">Saved images</h2>
            <p className="text-sm text-[color:var(--muted)]">Everything from the generation history remains available here.</p>
          </div>
          <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
            {items.length} items
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.length === 0 ? (
            <div className="col-span-full rounded-[24px] border border-dashed border-white/15 px-6 py-16 text-center text-sm text-[color:var(--muted)]">
              Your saved images will appear here.
            </div>
          ) : (
            items.map((item, index) => (
              <article key={item.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60">
                <button type="button" onClick={() => setLightboxIndex(index)} className="block w-full text-left">
                  <div className="relative aspect-square w-full">
                    <Image
                      src={`/api/library/${item.id}/image`}
                      alt={item.prompt}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover cursor-pointer"
                    />
                  </div>
                </button>
                <div className="space-y-3 p-4">
                  <div className="space-y-1">
                    <p className="line-clamp-2 text-sm font-medium text-slate-100">{item.prompt}</p>
                    <p className="text-xs text-[color:var(--muted)]">{item.model}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs text-[color:var(--muted)]">
                    <span>{item.aspectRatio}</span>
                    <span>{item.imageSize}</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/library/${item.id}/image`}
                      download={`${item.id}.png`}
                      className="inline-flex rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => void addLibraryItemAsUpload(item)}
                      className="inline-flex rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                    >
                      Add as upload
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="inline-flex rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-rose-300/30 hover:bg-rose-300/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {lightboxIndex !== null ? (
        <ImageLightbox
          items={lightboxItems}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </main>
  );
}
