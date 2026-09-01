"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function toDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDays(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: firstWeekday }, () => undefined),
    ...Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index + 1)),
  ];
}

export default function CalendarDatePicker({
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  required = false,
  allowClear = false,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  allowClear?: boolean;
}) {
  const initialDate = toDate(defaultValue);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolledValue;
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => initialDate ? new Date(initialDate.getFullYear(), initialDate.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const todayValue = toValue(new Date());

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (controlledValue === undefined) setUncontrolledValue(defaultValue ?? "");
  }, [controlledValue, defaultValue]);

  function changeValue(nextValue: string) {
    if (controlledValue === undefined) setUncontrolledValue(nextValue);
    onChange?.(nextValue);
  }

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function select(date: Date) {
    changeValue(toValue(date));
    setOpen(false);
  }

  function moveToToday() {
    const date = new Date();
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    select(date);
  }

  return (
    <div ref={rootRef} className="relative">
      <input key={`${name}-${value || "empty"}`} type="hidden" name={name} defaultValue={value} />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${name === "deathDate" ? "死亡日" : "購入日"}をカレンダーから選択`}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-white/10 bg-black/25 px-2.5 text-xs text-gray-100 outline-none transition-colors hover:border-white/20 focus:border-cyan-400/50"
      >
        <span className={value ? "tabular-nums text-gray-100" : "text-gray-600"}>{value || "日付を選択"}</span>
        <CalendarDays className="h-3.5 w-3.5 text-cyan-500" />
      </button>
      {required && !value && <span className="sr-only" role="alert">日付を選択してください。</span>}

      {open && (
        <div role="dialog" aria-label="日付を選択" className="absolute left-0 top-[calc(100%+0.35rem)] z-[90] w-[276px] rounded-xl border border-white/12 bg-[#171920] p-3 shadow-2xl shadow-black/70">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => changeMonth(-1)} aria-label="前の月" className="rounded-md p-1.5 text-gray-500 hover:bg-white/8 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
            <div aria-live="polite" className="text-xs font-bold text-white">{visibleMonth.getFullYear()}年 {visibleMonth.getMonth() + 1}月</div>
            <button type="button" onClick={() => changeMonth(1)} aria-label="次の月" className="rounded-md p-1.5 text-gray-500 hover:bg-white/8 hover:text-white"><ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[9px] font-semibold text-gray-600">
            {WEEKDAYS.map((weekday, index) => <div key={weekday} className={`py-1 ${index === 0 ? "text-rose-500/70" : index === 6 ? "text-sky-500/70" : ""}`}>{weekday}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {monthDays(visibleMonth).map((date, index) => date ? (
              <button
                type="button"
                key={toValue(date)}
                aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`}
                aria-pressed={value === toValue(date)}
                onClick={() => select(date)}
                className={`flex h-8 items-center justify-center rounded-md text-[10px] tabular-nums transition-colors ${
                  value === toValue(date)
                    ? "bg-cyan-400 font-bold text-slate-950"
                    : todayValue === toValue(date)
                      ? "border border-cyan-400/35 bg-cyan-400/8 font-semibold text-cyan-200 hover:bg-cyan-400/15"
                      : date.getDay() === 0
                        ? "text-rose-300/80 hover:bg-white/8"
                        : date.getDay() === 6
                          ? "text-sky-300/80 hover:bg-white/8"
                          : "text-gray-300 hover:bg-white/8"
                }`}
              >
                {date.getDate()}
              </button>
            ) : <span key={`blank-${index}`} />)}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-white/8 pt-2">
            {allowClear ? <button type="button" onClick={() => { changeValue(""); setOpen(false); }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-gray-500 hover:bg-white/5 hover:text-gray-200"><X className="h-3 w-3" />未設定にする</button> : <span />}
            <button type="button" onClick={moveToToday} className="rounded px-2 py-1 text-[10px] font-semibold text-cyan-400 hover:bg-cyan-400/8">今日</button>
          </div>
        </div>
      )}
    </div>
  );
}
