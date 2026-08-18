"use client";

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
  return (
    <>
      <input
        type="search"
        list={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        className={`h-7 min-w-40 rounded-md border border-white/10 bg-[#101018] px-2 text-[11px] text-gray-200 outline-none placeholder:text-gray-600 ${accentClassName}`}
      />
      <datalist id={id}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}
