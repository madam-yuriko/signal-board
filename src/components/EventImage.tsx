"use client";

import { useState } from "react";

/**
 * 興行カードの上部に表示する代表画像（バナー）。
 * 読み込み失敗時はグラデーション背景だけを残してレイアウト崩れを防ぐ。
 */
export default function EventImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-28 w-full overflow-hidden bg-gradient-to-br from-red-900/50 via-zinc-900 to-amber-900/40">
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover opacity-90 transition-transform duration-500 ease-out group-hover:scale-105"
        />
      )}
      {/* 下端をカード色に馴染ませて見出しと自然につなげる */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#14141c] via-transparent to-black/10" />
    </div>
  );
}
