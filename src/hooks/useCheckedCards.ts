"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  checkedCardItemKey,
  hasCheckedCardsSqliteMigration,
  isCheckedCardItemForScope,
  markCheckedCardsSqliteMigration,
  readCheckedCardKeys,
  readCheckedCardSnapshots,
  replaceCheckedCardScope,
  type CheckedCardItem,
  type CheckedCardScope,
  type CheckedCardSnapshots,
} from "@/lib/checkedCards";

interface StoredCardPayload {
  key?: unknown;
  item?: unknown;
}

interface UseCheckedCardsResult<T extends CheckedCardItem> {
  checkedItems: T[];
  checkedCount: number;
  loaded: boolean;
  isChecked: (item: T) => boolean;
  toggle: (item: T) => void;
}

export function useCheckedCards<T extends CheckedCardItem>(
  scope: CheckedCardScope | undefined,
  items: T[],
): UseCheckedCardsResult<T> {
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<CheckedCardSnapshots>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!scope) {
      const timer = window.setTimeout(() => {
        setCheckedKeys([]);
        setSnapshots({});
        setLoaded(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const controller = new AbortController();
    const prefix = `${scope}:`;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setLoaded(false);
    }, 0);

    const currentItemsByKey = new Map(
      items.map((item) => [checkedCardItemKey(scope, item), item]),
    );

    const applyLocalFallback = () => {
      const keys = readCheckedCardKeys().filter((key) => key.startsWith(prefix));
      const localSnapshots = readCheckedCardSnapshots();
      const scopedSnapshots: CheckedCardSnapshots = {};
      for (const key of keys) {
        const item = localSnapshots[key] ?? currentItemsByKey.get(key);
        if (isCheckedCardItemForScope(scope, item)) scopedSnapshots[key] = item;
      }
      if (cancelled) return;
      setCheckedKeys(keys);
      setSnapshots(scopedSnapshots);
      setLoaded(true);
    };

    const addStoredCards = (
      target: Map<string, T>,
      cards: StoredCardPayload[] | undefined,
    ) => {
      for (const card of cards ?? []) {
        if (typeof card.key === "string" &&
          isCheckedCardItemForScope(scope, card.item)) {
          target.set(card.key, card.item as T);
        }
      }
    };

    const load = async () => {
      const legacyKeys = readCheckedCardKeys().filter((key) => key.startsWith(prefix));
      const legacySnapshots = readCheckedCardSnapshots();

      try {
        const response = await fetch(`/api/checked-cards?scope=${scope}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("checked cards request failed");
        const result = (await response.json()) as { cards?: StoredCardPayload[] };
        const stored = new Map<string, T>();
        addStoredCards(stored, result.cards);

        if (!hasCheckedCardsSqliteMigration(scope)) {
          const legacyCards = legacyKeys.flatMap((key) => {
            const item = legacySnapshots[key] ?? currentItemsByKey.get(key);
            return isCheckedCardItemForScope(scope, item) ? [{ key, item }] : [];
          });

          if (legacyCards.length > 0) {
            const migrationResponse = await fetch("/api/checked-cards", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scope, cards: legacyCards }),
              cache: "no-store",
              signal: controller.signal,
            });
            if (!migrationResponse.ok) throw new Error("checked cards migration failed");
            const migrationResult = (await migrationResponse.json()) as {
              cards?: StoredCardPayload[];
            };
            addStoredCards(stored, migrationResult.cards);
          }
          markCheckedCardsSqliteMigration(scope);
        }

        if (cancelled) return;
        setCheckedKeys([...stored.keys()]);
        setSnapshots(Object.fromEntries(stored));
        setLoaded(true);
      } catch (error) {
        if (controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")) return;
        applyLocalFallback();
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(loadingTimer);
    };
  }, [items, scope]);

  useEffect(() => {
    if (scope && loaded) replaceCheckedCardScope(scope, checkedKeys, snapshots);
  }, [checkedKeys, loaded, scope, snapshots]);

  const checkedItems = useMemo(() => {
    if (!scope) return [];
    const wanted = new Set(checkedKeys);
    const byKey = new Map<string, T>();
    for (const item of items) {
      const key = checkedCardItemKey(scope, item);
      if (wanted.has(key)) byKey.set(key, item);
    }
    for (const [key, item] of Object.entries(snapshots)) {
      if (wanted.has(key) && !byKey.has(key) && isCheckedCardItemForScope(scope, item)) {
        byKey.set(key, item as T);
      }
    }
    return [...byKey.values()];
  }, [checkedKeys, items, scope, snapshots]);

  const isChecked = useCallback((item: T) => {
    if (!scope) return false;
    return checkedKeys.includes(checkedCardItemKey(scope, item));
  }, [checkedKeys, scope]);

  const toggle = useCallback((item: T) => {
    if (!scope || !loaded) return;
    const key = checkedCardItemKey(scope, item);
    const checked = checkedKeys.includes(key);
    const previousItem = snapshots[key] ?? item;

    setCheckedKeys((current) => checked
      ? current.filter((value) => value !== key)
      : [...current, key]);
    setSnapshots((current) => {
      const next = { ...current };
      if (checked) delete next[key];
      else next[key] = item;
      return next;
    });

    const request = checked
      ? fetch(`/api/checked-cards?scope=${scope}&key=${encodeURIComponent(key)}`, {
          method: "DELETE",
          cache: "no-store",
        })
      : fetch("/api/checked-cards", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, key, item }),
          cache: "no-store",
        });

    void request.then((response) => {
      if (!response.ok) throw new Error("checked card update failed");
    }).catch(() => {
      setCheckedKeys((current) => checked
        ? (current.includes(key) ? current : [...current, key])
        : current.filter((value) => value !== key));
      setSnapshots((current) => {
        const next = { ...current };
        if (checked) next[key] = previousItem;
        else delete next[key];
        return next;
      });
    });
  }, [checkedKeys, loaded, scope, snapshots]);

  return {
    checkedItems,
    checkedCount: checkedKeys.length,
    loaded,
    isChecked,
    toggle,
  };
}
