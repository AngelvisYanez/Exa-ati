"use client";

import { useCallback, useEffect, useState } from "react";

export type ViewMode = "lista" | "cuadricula";

export function useViewMode(storageKey: string): [ViewMode, (mode: ViewMode) => void] {
  const key = `ofsercont:view:${storageKey}`;
  const [mode, setMode] = useState<ViewMode>("lista");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === "lista" || stored === "cuadricula") {
        setMode(stored);
      }
    } catch {
      // localStorage no disponible
    }
  }, [key]);

  const update = useCallback(
    (next: ViewMode) => {
      setMode(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // cuota o modo privado
      }
    },
    [key]
  );

  return [mode, update];
}
