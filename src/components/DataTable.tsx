"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";

type SortValue = string | number | null | undefined;

export interface DataTableColumn<T> {
  id: string;
  label: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => SortValue;
  align?: "left" | "center" | "right";
  hideOnMobile?: boolean;
  primary?: boolean;
  className?: string;
}

export interface DataTableSort {
  columnId: string;
  direction: "asc" | "desc";
}

interface Props<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  defaultSort?: DataTableSort;
  defaultCompareRows?: (left: T, right: T) => number;
  emptyMessage?: string;
  pageSize?: number;
  onPageChange?: (page: number, rows: T[]) => void;
}

function compareValues(a: SortValue, b: SortValue): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ja", {
    numeric: true,
    sensitivity: "base",
  });
}

export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort,
  defaultCompareRows,
  emptyMessage = "表示できるデータがありません。",
  pageSize,
  onPageChange,
}: Props<T>) {
  const [sort, setSort] = useState<DataTableSort | undefined>(defaultSort);
  const [requestedPage, setRequestedPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((item) => item.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const usingDefaultComparator =
      Boolean(defaultCompareRows && defaultSort) &&
      sort.columnId === defaultSort?.columnId &&
      sort.direction === defaultSort?.direction;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        if (usingDefaultComparator && defaultCompareRows) {
          const compared = defaultCompareRows(a.row, b.row);
          return compared === 0 ? a.index - b.index : compared;
        }
        const aValue = column.sortValue?.(a.row);
        const bValue = column.sortValue?.(b.row);
        const aEmpty = aValue === null || aValue === undefined || aValue === "";
        const bEmpty = bValue === null || bValue === undefined || bValue === "";
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        const compared = compareValues(aValue, bValue);
        if (compared === 0) return a.index - b.index;
        return sort.direction === "asc" ? compared : -compared;
      })
      .map(({ row }) => row);
  }, [columns, defaultCompareRows, defaultSort, rows, sort]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const currentPage = Math.min(requestedPage, pageCount - 1);
  const visibleRows = pageSize
    ? sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedRows;
  const firstVisibleRow = pageSize ? currentPage * pageSize + 1 : 1;
  const lastVisibleRow = pageSize
    ? Math.min((currentPage + 1) * pageSize, sortedRows.length)
    : sortedRows.length;

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    setRequestedPage(0);
    setSort((current) => {
      if (!current || current.columnId !== column.id) {
        return { columnId: column.id, direction: "asc" };
      }
      return {
        columnId: column.id,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
  }

  function changePage(nextPage: number) {
    const boundedPage = Math.max(0, Math.min(pageCount - 1, nextPage));
    setRequestedPage(boundedPage);
    if (onPageChange && pageSize) {
      onPageChange(
        boundedPage,
        sortedRows.slice(boundedPage * pageSize, (boundedPage + 1) * pageSize),
      );
    }
  }

  function paginationControls(className: string) {
    if (!pageSize || pageCount <= 1) return null;
    return (
      <div className={className}>
        <span>
          {firstVisibleRow.toLocaleString("ja-JP")}–
          {lastVisibleRow.toLocaleString("ja-JP")} / {rows.length.toLocaleString("ja-JP")}件
        </span>
        <div className="flex items-center gap-2">
          <span>
            {currentPage + 1} / {pageCount}ページ
          </span>
          <button
            type="button"
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 0}
            className="rounded border border-white/10 p-1 text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="前のページ"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === pageCount - 1}
            className="rounded border border-white/10 p-1 text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="次のページ"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card rounded-lg px-4 py-10 text-center text-xs text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden rounded-lg">
      {paginationControls(
        "flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 text-[11px] text-gray-500",
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="border-b border-white/10 bg-white/[0.04] text-[10px] font-semibold text-gray-400">
            <tr>
              {columns.map((column) => {
                const active = sort?.columnId === column.id;
                const alignment =
                  column.align === "right"
                    ? "text-right"
                    : column.align === "center"
                      ? "text-center"
                      : "text-left";
                return (
                  <th
                    key={column.id}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={`whitespace-nowrap px-3 py-2 ${alignment} ${
                      column.hideOnMobile ? "hidden sm:table-cell" : ""
                    } ${column.primary ? "sticky left-0 z-10 bg-[#17171f]" : ""}`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={`inline-flex items-center gap-1 hover:text-white ${
                          column.align === "right" ? "ml-auto" : ""
                        }`}
                      >
                        {column.label}
                        {active ? (
                          sort.direction === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleRows.map((row) => (
              <tr key={rowKey(row)} className="group/row hover:bg-white/[0.04]">
                {columns.map((column) => {
                  const alignment =
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left";
                  return (
                    <td
                      key={column.id}
                      className={`px-3 py-2 align-top text-gray-300 ${alignment} ${
                        column.hideOnMobile ? "hidden sm:table-cell" : ""
                      } ${
                        column.primary
                          ? "sticky left-0 z-[1] bg-[#14141c] font-semibold text-white group-hover/row:bg-[#1a1a23]"
                          : ""
                      } ${column.className ?? ""}`}
                    >
                      {column.render(row)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginationControls(
        "flex items-center justify-between gap-3 border-t border-white/5 px-3 py-2 text-[11px] text-gray-500",
      )}
      <div className="border-t border-white/5 px-3 py-1.5 text-right text-[10px] text-gray-600 sm:hidden">
        横にスクロールして全項目を表示
      </div>
    </div>
  );
}
