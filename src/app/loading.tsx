import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="glass-card flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg text-center"
    >
      <LoaderCircle className="h-6 w-6 animate-spin text-cyan-300" />
      <div>
        <div className="text-sm font-semibold text-gray-200">データを読み込み中</div>
        <div className="mt-1 text-[11px] text-gray-500">
          画面を移動しました。取得中のデータが表示されるまでお待ちください。
        </div>
      </div>
    </div>
  );
}
