"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { AvailableImageModel, ImageAspectRatio, ImageSizeChoice } from "@/lib/google-genai";
import type { LibraryItem } from "@/lib/library-store";

const ASPECT_RATIOS: ImageAspectRatio[] = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
const IMAGE_SIZES: ImageSizeChoice[] = ["512", "1K", "2K", "4K"];
const SESSION_PROMPT_KEY = "studio:prompt";
const SESSION_MODEL_KEY = "studio:model";
const SESSION_RATIO_KEY = "studio:aspectRatio";
const SESSION_SIZE_KEY = "studio:imageSize";

type StudioProps = {
  initialModels: AvailableImageModel[];
  initialModelError?: string;
  initialLibraryItems: LibraryItem[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ImageStudio({ initialModels, initialModelError, initialLibraryItems }: StudioProps) {
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [model, setModel] = useState(initialModels[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("1:1");
  const [imageSize, setImageSize] = useState<ImageSizeChoice>("1K");
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [items, setItems] = useState(initialLibraryItems);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialLibraryItems[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialModelError ?? null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? items[0] ?? null,
    [items, selectedItemId],
  );

  useEffect(() => {
    const savedPrompt = sessionStorage.getItem(SESSION_PROMPT_KEY);
    if (savedPrompt !== null) {
      setPrompt(savedPrompt);
    }

    const savedModel = sessionStorage.getItem(SESSION_MODEL_KEY);
    if (savedModel && initialModels.some((entry) => entry.id === savedModel)) {
      setModel(savedModel);
    }

    const savedRatio = sessionStorage.getItem(SESSION_RATIO_KEY);
    if (savedRatio && ASPECT_RATIOS.includes(savedRatio as ImageAspectRatio)) {
      setAspectRatio(savedRatio as ImageAspectRatio);
    }

    const savedSize = sessionStorage.getItem(SESSION_SIZE_KEY);
    if (savedSize && IMAGE_SIZES.includes(savedSize as ImageSizeChoice)) {
      setImageSize(savedSize as ImageSizeChoice);
    }
  }, [initialModels]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_PROMPT_KEY, prompt);
  }, [prompt]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_MODEL_KEY, model);
  }, [model]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_RATIO_KEY, aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_SIZE_KEY, imageSize);
  }, [imageSize]);

  async function handleSubmit() {
    if (!model) {
      setError("Select a model first.");
      return;
    }

    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }

    if (mode === "edit" && !baseFile) {
      setError("Add a base image for edit mode.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("mode", mode);
      formData.set("model", model);
      formData.set("prompt", prompt);
      formData.set("aspectRatio", aspectRatio);
      formData.set("imageSize", imageSize);

      if (baseFile) {
        formData.set("baseImage", baseFile);
      }

      for (const file of referenceFiles) {
        formData.append("references", file);
      }

      if (maskFile) {
        formData.set("mask", maskFile);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { item?: LibraryItem; previewUrl?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Generation failed.");
      }

      if (payload.item) {
        setItems((currentItems) => [payload.item!, ...currentItems.filter((item) => item.id !== payload.item!.id)]);
        setSelectedItemId(payload.item.id);
      }

      if (payload.previewUrl) {
        window.setTimeout(() => {
          const image = new window.Image();
          image.src = `${payload.previewUrl}?t=${Date.now()}`;
        }, 0);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    const response = await fetch(`/api/library/${id}`, { method: "DELETE" });

    if (!response.ok && response.status !== 204) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Delete failed.");
      return;
    }

    setItems((currentItems) => currentItems.filter((item) => item.id !== id));

    if (selectedItemId === id) {
      const next = items.find((item) => item.id !== id) ?? null;
      setSelectedItemId(next?.id ?? null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-white/10 bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100">
              Gemini image workspace
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create and edit images only.</h1>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                Fixed Nano Banana model set, PNG output, reference uploads for edits, and a persistent server library.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value === "edit" ? "edit" : "generate")}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              >
                <option value="generate">Generate</option>
                <option value="edit">Edit</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Model</span>
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              >
                {initialModels.length === 0 ? (
                  <option value="">No image models available</option>
                ) : (
                  initialModels.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.displayName}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-200">Prompt</span>
              <textarea
                rows={6}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the image you want to create or how you want to edit the reference image."
                className="rounded-3xl border border-white/10 bg-slate-950/60 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Aspect ratio</span>
              <select
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value as ImageAspectRatio)}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              >
                {ASPECT_RATIOS.map((ratio) => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-200">Generation size</span>
              <select
                value={imageSize}
                onChange={(event) => setImageSize(event.target.value as ImageSizeChoice)}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
              >
                {IMAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            {mode === "edit" ? (
              <>
                <label className="flex flex-col gap-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-200">Base image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setBaseFile(event.target.files?.[0] ?? null)}
                    className="rounded-2xl border border-dashed border-white/15 bg-slate-950/45 px-4 py-4 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-300/15 file:px-4 file:py-2 file:text-cyan-100"
                  />
                  <span className="text-xs leading-5 text-[color:var(--muted)]">
                    Required. This image is the base canvas that will be edited.
                  </span>
                </label>

                <label className="flex flex-col gap-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-200">Reference images</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => setReferenceFiles(Array.from(event.target.files ?? []))}
                    className="rounded-2xl border border-dashed border-white/15 bg-slate-950/45 px-4 py-4 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-300/15 file:px-4 file:py-2 file:text-cyan-100"
                  />
                  <span className="text-xs leading-5 text-[color:var(--muted)]">
                    Optional. These images are extra references to guide style/content.
                  </span>
                </label>

                <label className="flex flex-col gap-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-200">Mask image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setMaskFile(event.target.files?.[0] ?? null)}
                    className="rounded-2xl border border-dashed border-white/15 bg-slate-950/45 px-4 py-4 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-300/15 file:px-4 file:py-2 file:text-cyan-100"
                  />
                  <span className="text-xs leading-5 text-[color:var(--muted)]">
                    Optional inpainting mask. White areas indicate what should be edited.
                  </span>
                </label>
              </>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy || initialModels.length === 0 || !prompt.trim()}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Working…" : mode === "edit" ? "Edit image" : "Generate image"}
            </button>

            <p className="text-sm text-[color:var(--muted)]">
              Output is always stored as PNG in the server library.
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </div>

        <aside className="rounded-[28px] border border-white/10 bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-semibold">Result</h2>
              <p className="text-sm text-[color:var(--muted)]">The latest saved image appears here.</p>
            </div>
            <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              Library aware
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60">
            {selectedItem ? (
              <>
                <div className="relative aspect-square w-full">
                  <Image
                    src={`/api/library/${selectedItem.id}/image`}
                    alt={selectedItem.prompt}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-sm font-medium text-slate-100">{selectedItem.prompt}</p>
                  <div className="grid gap-2 text-xs text-[color:var(--muted)] sm:grid-cols-2">
                    <span>Model: {selectedItem.model}</span>
                    <span>Mode: {selectedItem.mode}</span>
                    <span>Ratio: {selectedItem.aspectRatio}</span>
                    <span>Size: {selectedItem.imageSize}</span>
                    <span>References: {selectedItem.referenceCount}</span>
                    <span>{formatDate(selectedItem.createdAt)}</span>
                  </div>
                  <a
                    href={`/api/library/${selectedItem.id}/image`}
                    download={`${selectedItem.id}.png`}
                    className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
                  >
                    Download PNG
                  </a>
                </div>
              </>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center text-sm text-[color:var(--muted)]">
                <div className="rounded-full border border-dashed border-white/15 px-4 py-2 text-slate-300">
                  No image selected yet
                </div>
                <p>Generate or edit an image to preview it here.</p>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-[color:var(--panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold">Library</h2>
            <p className="text-sm text-[color:var(--muted)]">Saved PNGs live on the server filesystem and survive refreshes.</p>
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
            items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60">
                <button type="button" onClick={() => setSelectedItemId(item.id)} className="block w-full text-left">
                  <div className="relative aspect-square w-full">
                    <Image
                      src={`/api/library/${item.id}/image`}
                      alt={item.prompt}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover"
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
                    <span>{item.mode}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/library/${item.id}/image`}
                      download={`${item.id}.png`}
                      className="inline-flex rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
                    >
                      Download
                    </a>
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
    </div>
  );
}