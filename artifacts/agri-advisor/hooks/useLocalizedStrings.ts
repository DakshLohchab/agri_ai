import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { translateMany } from "@/services/translation";

export function useLocalizedStrings<T extends Record<string, string>>(strings: T): T {
  const { language } = useLanguage();
  const signature = useMemo(() => JSON.stringify(strings), [strings]);
  const entries = useMemo(() => Object.entries(strings), [signature]);
  const baseStrings = useMemo(() => Object.fromEntries(entries) as T, [entries]);
  const [translated, setTranslated] = useState<T>(baseStrings);

  useEffect(() => {
    setTranslated(baseStrings);
  }, [baseStrings]);

  useEffect(() => {
    let cancelled = false;

    if (language.code === "en") {
      setTranslated(baseStrings);
      return;
    }

    translateMany(
      entries.map(([, value]) => value),
      language.code,
      "en"
    )
      .then((values) => {
        if (cancelled) return;
        const next = { ...baseStrings } as T;
        entries.forEach(([key], index) => {
          next[key as keyof T] = values[index] as T[keyof T];
        });
        setTranslated(next);
      })
      .catch(() => {
        if (!cancelled) setTranslated(baseStrings);
      });

    return () => {
      cancelled = true;
    };
  }, [baseStrings, entries, language.code]);

  return translated;
}
