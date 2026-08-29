"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [model, setModel] = useState(initialModels[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>("1:1");
  const [imageSize, setImageSize] = useState<ImageSizeChoice>("1K");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [items, setItems] = useState(initialLibraryItems);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialLibraryItems[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialModelError ?? null);
  const [addingUploadIds, setAddingUploadIds] = useState<string[]>([]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

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

  function isAcceptedImage(file: File) {
    return file.type.startsWith("image/");
  }

  function appendUploadFileArray(incomingFiles: File[]) {
    if (incomingFiles.length === 0) {
      return;
    }

    const validFiles = incomingFiles.filter(isAcceptedImage);

    if (validFiles.length !== incomingFiles.length) {
      setError("Only image files are allowed in uploads.");
    }

    if (validFiles.length === 0) {
      return;
    }

    setUploadFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const deduped = validFiles.filter((file) => {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      return [...current, ...deduped];
    });
  }

  function appendUploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    appendUploadFileArray(Array.from(fileList));
  }

  async function addLibraryItemAsUpload(item: LibraryItem) {
    if (addingUploadIds.includes(item.id)) {
      return;
    }

    setAddingUploadIds((current) => [...current, item.id]);
    setError(null);

    try {
      const response = await fetch(`/api/library/${item.id}/image`);

      if (!response.ok) {
        throw new Error("Could not load the selected library image.");
      }

      const blob = await response.blob();

      if (!blob.type.startsWith("image/")) {
        throw new Error("Only image files are allowed in uploads.");
      }

      const timestamp = Number.isNaN(Date.parse(item.createdAt)) ? Date.now() : Date.parse(item.createdAt);
      const file = new File([blob], `${item.id}.png`, {
        type: blob.type || item.mimeType || "image/png",
        lastModified: timestamp,
      });

      appendUploadFileArray([file]);
    } catch (libraryUploadError) {
      setError(libraryUploadError instanceof Error ? libraryUploadError.message : "Could not add library image as upload.");
    } finally {
      setAddingUploadIds((current) => current.filter((id) => id !== item.id));
    }
  }

  function handleUploadInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    appendUploadFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragOver(false);
    appendUploadFiles(event.dataTransfer.files);
  }

  function removeUploadFile(index: number) {
    setUploadFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function isLibraryItemUploaded(itemId: string) {
    const expectedName = `${itemId}.png`;
    return uploadFiles.some((file) => file.name === expectedName);
  }

  async function handleSubmit() {
    if (!model) {
      setError("Select a model first.");
      return;
    }

    if (!prompt.trim()) {
      setError("Prompt is required.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("model", model);
      formData.set("prompt", prompt);
      formData.set("aspectRatio", aspectRatio);
      formData.set("imageSize", imageSize);

      for (const file of uploadFiles) {
        formData.append("uploads", file);
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
              Nano Banana 🍌
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create images</h1>
              <p className="max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                Image generation powered by Google Gemini, using the Nano Banana models.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

            <div className="hidden sm:block" aria-hidden="true" />

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-200">Prompt</span>
              <textarea
                rows={6}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe what you want. Without uploads, it generates from scratch. With uploads, your prompt decides how to use them."
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

            <label
              className={`flex flex-col gap-2 sm:col-span-2 rounded-2xl border border-dashed px-4 py-4 text-sm transition ${
                isDragOver ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/15 bg-slate-950/45"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isDragOver) {
                  setIsDragOver(true);
                }
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <span className="text-sm font-medium text-slate-200">Uploads (optional)</span>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadInputChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="w-fit rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
              >
                Choose images
              </button>
              <span className="text-xs leading-5 text-[color:var(--muted)]">
                Drag and drop images here or click to add. Uploaded images are treated equally as prompt context.
              </span>

              {uploadFiles.length > 0 ? (
                <ul className="mt-2 grid gap-2">
                  {uploadFiles.map((file, index) => (
                    <li
                      key={`${file.name}:${file.size}:${file.lastModified}:${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2"
                    >
                      <span className="truncate text-xs text-slate-200">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeUploadFile(index)}
                        className="rounded-full border border-white/15 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-rose-300/35 hover:bg-rose-300/10"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy || initialModels.length === 0 || !prompt.trim()}
              className="rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Working..." : uploadFiles.length > 0 ? "Create with uploads" : "Generate image"}
            </button>
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
              <h2 className="text-xl font-semibold">Last result</h2>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-slate-950/60 flex flex-col">
            {selectedItem ? (
              <>
                <div className="w-full">
                  <img src={`/api/library/${selectedItem.id}/image`} alt={selectedItem.prompt} className="block h-auto w-full" />
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-sm font-medium text-slate-100">{selectedItem.prompt}</p>
                  <div className="grid gap-2 text-xs text-[color:var(--muted)] sm:grid-cols-2">
                    <span>Model: {selectedItem.model}</span>
                    <span>Ratio: {selectedItem.aspectRatio}</span>
                    <span>Size: {selectedItem.imageSize}</span>
                    <span>Uploads: {selectedItem.referenceCount}</span>
                    <span>{formatDate(selectedItem.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                  <a
                    href={`/api/library/${selectedItem.id}/image`}
                    download={`${selectedItem.id}.png`}
                    className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-300/18"
                  >
                    Download PNG
                  </a>
                  <button
                    type="button"
                    onClick={() => void addLibraryItemAsUpload(selectedItem)}
                    disabled={addingUploadIds.includes(selectedItem.id) || isLibraryItemUploaded(selectedItem.id)}
                    className="inline-flex rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLibraryItemUploaded(selectedItem.id)
                      ? "Uploaded"
                      : addingUploadIds.includes(selectedItem.id)
                        ? "Adding..."
                        : "Add as upload"}
                  </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center text-sm text-[color:var(--muted)]">
                <div className="rounded-full border border-dashed border-white/15 px-4 py-2 text-slate-300">
                  No image selected yet
                </div>
                <p>Generate from scratch or upload context images to preview the result here.</p>
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
                      onClick={() => void addLibraryItemAsUpload(item)}
                      disabled={addingUploadIds.includes(item.id) || isLibraryItemUploaded(item.id)}
                      className="inline-flex rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLibraryItemUploaded(item.id)
                        ? "Uploaded"
                        : addingUploadIds.includes(item.id)
                          ? "Adding..."
                          : "Add as upload"}
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
    </div>
  );
}