"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";

export default function BoxingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="glass-card flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg px-5 text-center"
    >
      <TriangleAlert className="h-7 w-7 text-rose-300" />
      <div>
        <h1 className="text-base font-bold text-white">
          ボクシングデータを取得できませんでした
        </h1>
        <p className="mt-1 max-w-xl text-xs leading-relaxed text-gray-400">
          最新データを取得できないため、件数の少ない保存済みデータは表示していません。
        </p>
        <p className="mt-2 text-xs text-rose-200">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:border-white/30 hover:text-white"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        再試行
      </button>
    </div>
  );
}
