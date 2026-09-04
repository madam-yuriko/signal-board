"use client";

import { useCallback, useMemo, useState } from "react";

export const CARD_LIST_PAGE_SIZE = 30;

export function useCardListPagination<T>(items: T[]) {
  const [visibleCount, setVisibleCount] = useState(CARD_LIST_PAGE_SIZE);
  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );
  const showMore = useCallback(() => {
    setVisibleCount((current) => current + CARD_LIST_PAGE_SIZE);
  }, []);
  const reset = useCallback(() => {
    setVisibleCount(CARD_LIST_PAGE_SIZE);
  }, []);

  return { visibleItems, showMore, reset };
}

export default function CardListPagination({
  visibleCount,
  totalCount,
  onShowMore,
}: {
  visibleCount: number;
  totalCount: number;
  onShowMore: () => void;
}) {
  if (visibleCount >= totalCount) return null;
  const nextCount = Math.min(CARD_LIST_PAGE_SIZE, totalCount - visibleCount);

  return (
    <div className="mt-1 flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onShowMore}
        className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-gray-100 hover:border-white/35 hover:bg-white/10"
      >
        さらに{nextCount}件表示
      </button>
      <span className="text-[10px] text-gray-600">
        {visibleCount}件表示 / 全{totalCount}件
      </span>
    </div>
  );
}
