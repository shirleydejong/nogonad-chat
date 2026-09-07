"use client";

import { useEffect, useMemo, useState } from "react";

export type LightboxItem = {
  id: string;
  prompt: string;
  imageUrl: string;
};

type ImageLightboxProps = {
  items: LightboxItem[];
  startIndex: number;
  onClose: () => void;
};

export function ImageLightbox({ items, startIndex, onClose }: ImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(startIndex);

  useEffect(() => {
    setActiveIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (items.length === 0 ? 0 : (current + 1) % items.length));
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (items.length === 0 ? 0 : (current - 1 + items.length) % items.length));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items.length, onClose]);

  const item = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    return items[activeIndex] ?? items[0];
  }, [activeIndex, items]);

  if (!item) {
    return null;
  }

  const showPrevious = items.length > 1;
  const showNext = items.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={item.prompt}
    >
      <div className="relative w-[min(96vw,1600px)] max-w-[96vw] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-900/70 text-lg text-slate-100 transition hover:border-cyan-300/30 hover:bg-slate-800"
          aria-label="Close image"
        >
          ×
        </button>

        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/70 px-5 py-3 text-xs uppercase tracking-[0.22em] text-slate-300">
          <span>Preview</span>
          <span>
            {activeIndex + 1} / {items.length}
          </span>
        </div>

        <div className="relative flex max-h-[88vh] items-center justify-center bg-slate-950">
          <img
            src={item.imageUrl}
            alt={item.prompt}
            className="block max-h-[84vh] max-w-full w-auto object-contain"
            style={{ maxWidth: "calc(100vw - 4rem)" }}
          />

          {showPrevious ? (
            <button
              type="button"
              onClick={() => setActiveIndex((current) => (current <= 0 ? items.length - 1 : current - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-slate-800"
              aria-label="Previous image"
            >
              ←
            </button>
          ) : null}

          {showNext ? (
            <button
              type="button"
              onClick={() => setActiveIndex((current) => (current >= items.length - 1 ? 0 : current + 1))}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-slate-900/80 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:bg-slate-800"
              aria-label="Next image"
            >
              →
            </button>
          ) : null}
        </div>

        <div className="border-t border-white/10 bg-slate-900/70 px-5 py-4 text-sm text-slate-100">
          {item.prompt}
        </div>
      </div>
    </div>
  );
}
