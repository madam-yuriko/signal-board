const STORAGE_KEY = "signal-board-checked-cards-v1";

export function checkedCardKey(scope: string, id: string): string {
  return `${scope}:${id}`;
}

export function readCheckedCardKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeCheckedCardKeys(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Ignore unavailable browser storage.
  }
}
