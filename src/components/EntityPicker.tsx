"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const MAX_RENDERED_OPTIONS = 80;

interface Props {
  id: string;
  value: string;
  options: string[];
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  accentClassName?: string;
}

export default function EntityPicker({
  id,
  value,
  options,
  placeholder,
  ariaLabel,
  onChange,
  accentClassName = "focus:border-white/30",
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const matchingOptions = useMemo(() => {
    const query = value
      .normalize("NFKC")
      .toLocaleLowerCase("ja")
      .replace(/\s+/g, "");
    if (!query) return options;

    return options.filter((option) =>
      option
        .normalize("NFKC")
        .toLocaleLowerCase("ja")
        .replace(/\s+/g, "")
        .includes(query),
    );
  }, [options, value]);
  const visibleOptions = useMemo(
    () => matchingOptions.slice(0, MAX_RENDERED_OPTIONS),
    [matchingOptions],
  );

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const selectOption = (option: string) => {
    onChange(option);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={rootRef} className="relative min-w-40">
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) =>
              Math.min(current + 1, visibleOptions.length - 1),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) =>
              current <= 0 ? visibleOptions.length - 1 : current - 1,
            );
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            selectOption(visibleOptions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={
          activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        className={`h-7 w-full rounded-md border border-white/10 bg-[#101018] px-2 text-[11px] text-gray-200 outline-none placeholder:text-gray-600 ${accentClassName}`}
      />

      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          aria-label={`${ariaLabel}の候補`}
          className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full min-w-56 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-md border border-white/15 bg-[#17171d] p-1 shadow-2xl shadow-black/60"
        >
          {matchingOptions.length > 0 ? (
            <>
              {visibleOptions.map((option, index) => (
                <button
                  key={option}
                  id={`${id}-option-${index}`}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={option === value}
                  title={option}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`block w-full truncate rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                    activeIndex === index || option === value
                      ? "bg-white/10 text-white"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
              {matchingOptions.length > visibleOptions.length && (
                <div className="sticky bottom-0 border-t border-white/10 bg-[#17171d] px-2 py-1.5 text-[10px] text-gray-500">
                  ほか
                  {(matchingOptions.length - visibleOptions.length).toLocaleString(
                    "ja-JP",
                  )}
                  件。名前を入力すると絞り込めます。
                </div>
              )}
            </>
          ) : (
            <div className="px-2 py-3 text-center text-[11px] text-gray-500">
              一致する候補がありません
            </div>
          )}
        </div>
      )}
    </div>
  );
}
