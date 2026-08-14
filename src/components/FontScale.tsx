"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, Type } from "lucide-react";

const STORAGE_KEY = "fontScale-v4"; // Ignore saved values from the larger scale.
const DEFAULT = 80; // Matches globals.css html font-size.
const MIN = 80;
const MAX = 140;
const STEP = 8;

function apply(scale: number) {
  document.documentElement.style.fontSize = `${scale}%`;
}

function readSaved(): number {
  if (typeof window === "undefined") return DEFAULT;
  const saved = Number(localStorage.getItem(STORAGE_KEY));
  return saved && !Number.isNaN(saved) ? saved : DEFAULT;
}

export default function FontScale() {
  // サーバーとブラウザで初回HTMLを一致させ、保存値はhydration後に反映する。
  const [scale, setScale] = useState<number>(DEFAULT);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readSaved();
      setScale(saved);
      apply(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function update(next: number) {
    const clamped = Math.min(MAX, Math.max(MIN, next));
    setScale(clamped);
    apply(clamped);
    localStorage.setItem(STORAGE_KEY, String(clamped));
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 p-0.5">
      <Type className="mx-1 hidden h-3 w-3 text-gray-400 sm:block" />
      <button
        type="button"
        onClick={() => update(scale - STEP)}
        disabled={scale <= MIN}
        title="文字を小さく"
        className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => update(DEFAULT)}
        title="文字サイズをリセット"
        suppressHydrationWarning
        className="min-w-[2.8em] rounded px-1 text-center text-[11px] tabular-nums text-gray-300 hover:bg-white/10 hover:text-white"
      >
        {Math.round(scale)}%
      </button>
      <button
        type="button"
        onClick={() => update(scale + STEP)}
        disabled={scale >= MAX}
        title="文字を大きく"
        className="flex h-6 w-6 items-center justify-center rounded text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
