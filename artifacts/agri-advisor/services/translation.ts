const LIBRE_TRANSLATE_URLS = [
  "https://libretranslate.com/translate",
  "https://translate.argosopentech.com/translate",
  "https://libretranslate.de/translate",
];

const MYMEMORY_LANG_MAP: Record<string, string> = {
  hi: "hi-IN",
  bn: "bn-IN",
  te: "te-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  ur: "ur-PK",
};

const LIBRE_LANG_MAP: Record<string, string> = {
  en: "en",
  hi: "hi",
  bn: "bn",
  te: "te",
  mr: "mr",
  ta: "ta",
  gu: "gu",
  kn: "kn",
  ml: "ml",
  pa: "pa",
  or: "or",
  ur: "ur",
};

const translationCache = new Map<string, string>();

function getCacheKey(text: string, sourceLang: string, targetLang: string) {
  return `${sourceLang}::${targetLang}::${text}`;
}

async function translateWithMyMemory(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const sourceTag =
      sourceLang === "auto"
        ? "autodetect"
        : MYMEMORY_LANG_MAP[sourceLang] ?? sourceLang;
    const targetTag = MYMEMORY_LANG_MAP[targetLang] ?? targetLang;
    const url =
      `https://api.mymemory.translated.net/get` +
      `?q=${encodeURIComponent(text)}&langpair=${sourceTag}|${targetTag}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data?.responseStatus === 200 && data?.responseData?.translatedText) {
      return data.responseData.translatedText as string;
    }
    return null;
  } catch {
    return null;
  }
}

async function translateWithLibreTranslate(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  const source = sourceLang === "auto" ? "auto" : LIBRE_LANG_MAP[sourceLang] ?? sourceLang;
  const target = LIBRE_LANG_MAP[targetLang] ?? targetLang;

  for (const baseUrl of LIBRE_TRANSLATE_URLS) {
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: "text",
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (data?.translatedText) return data.translatedText as string;
    } catch {
      // Try next provider.
    }
  }

  return null;
}

async function translateChunk(
  text: string,
  targetLang: string,
  sourceLang: string
): Promise<string> {
  const cacheKey = getCacheKey(text, sourceLang, targetLang);
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  const mm = await translateWithMyMemory(text, sourceLang, targetLang);
  const translated = mm ?? (await translateWithLibreTranslate(text, sourceLang, targetLang)) ?? text;
  translationCache.set(cacheKey, translated);
  return translated;
}

async function translateViaPivot(
  text: string,
  targetLang: string,
  sourceLang: string
): Promise<string | null> {
  if (targetLang === "en") return null;

  const english =
    sourceLang === "en"
      ? text
      : await translateChunk(text, "en", sourceLang === "auto" ? "auto" : sourceLang);

  if (!english.trim()) return null;
  if (english === text && sourceLang !== "en") return null;

  const translated = await translateChunk(english, targetLang, "en");
  return translated === english ? null : translated;
}

export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = "en"
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (targetLang === sourceLang && sourceLang !== "auto") return text;

  const direct = await translateChunk(text, targetLang, sourceLang);
  if (direct !== text) return direct;

  if (sourceLang !== "auto") {
    const autodetected = await translateChunk(text, targetLang, "auto");
    if (autodetected !== text) return autodetected;
  }

  const pivoted = await translateViaPivot(text, targetLang, sourceLang);
  if (pivoted && pivoted !== text) return pivoted;

  return text;
}

function preserveMarkdownTokens(text: string) {
  const placeholders: string[] = [];
  const protectedText = text.replace(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g, (match) => {
    const token = `__MD_TOKEN_${placeholders.length}__`;
    placeholders.push(match);
    return token;
  });

  return {
    protectedText,
    restore(translated: string) {
      return translated.replace(/__MD_TOKEN_(\d+)__/g, (_, index) => placeholders[Number(index)] ?? "");
    },
  };
}

async function translateInlinePreservingMarkdown(
  text: string,
  targetLang: string,
  sourceLang: string
): Promise<string> {
  const { protectedText, restore } = preserveMarkdownTokens(text);
  const translated = await translateText(protectedText, targetLang, sourceLang);
  return restore(translated);
}

export async function translateRichText(
  text: string,
  targetLang: string,
  sourceLang = "en"
): Promise<string> {
  if (!text.trim() || targetLang === sourceLang) return text;

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const translatedLines: string[] = [];
  let index = 0;

  const isTableLine = (line: string) => /^\|.+\|$/.test(line.trim());
  const isTableDivider = (line: string) =>
    /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line.trim());
  const parseTableRow = (line: string) =>
    line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      translatedLines.push(rawLine);
      index += 1;
      continue;
    }

    if (isTableLine(line)) {
      const tableBlock: string[] = [];
      while (index < lines.length && isTableLine(lines[index].trim())) {
        tableBlock.push(lines[index]);
        index += 1;
      }

      for (const tableLine of tableBlock) {
        const trimmed = tableLine.trim();
        if (isTableDivider(trimmed)) {
          translatedLines.push(trimmed);
          continue;
        }

        const translatedCells = await Promise.all(
          parseTableRow(trimmed).map((cell) =>
            cell ? translateText(cell, targetLang, sourceLang) : Promise.resolve(cell)
          )
        );
        translatedLines.push(`| ${translatedCells.join(" | ")} |`);
      }
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      translatedLines.push(
        `${headingMatch[1]} ${await translateText(headingMatch[2], targetLang, sourceLang)}`
      );
      index += 1;
      continue;
    }

    const bulletMatch = line.match(/^([-*])\s+(.+)$/);
    if (bulletMatch) {
      translatedLines.push(
        `${bulletMatch[1]} ${await translateInlinePreservingMarkdown(bulletMatch[2], targetLang, sourceLang)}`
      );
      index += 1;
      continue;
    }

    const numberedMatch = line.match(/^(\d+\.)\s+(.+)$/);
    if (numberedMatch) {
      translatedLines.push(
        `${numberedMatch[1]} ${await translateInlinePreservingMarkdown(numberedMatch[2], targetLang, sourceLang)}`
      );
      index += 1;
      continue;
    }

    const statMatch = line.match(/^(\*\*[^*]+\*\*|[^:]{1,60}):\s+(.+)$/);
    if (statMatch && !/^https?:\/\//i.test(statMatch[2].trim())) {
      const translatedLabel = await translateInlinePreservingMarkdown(
        statMatch[1].trim(),
        targetLang,
        sourceLang
      );
      const translatedValue = await translateInlinePreservingMarkdown(
        statMatch[2].trim(),
        targetLang,
        sourceLang
      );
      translatedLines.push(`${translatedLabel}: ${translatedValue}`);
      index += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line)) {
      translatedLines.push(line);
      index += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isTableLine(lines[index].trim()) &&
      !/^(#{1,6})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim()) &&
      !/^(\*\*[^*]+\*\*|[^:]{1,60}):\s+.+$/.test(lines[index].trim()) &&
      !/^(-{3,}|\*{3,})$/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    const translatedParagraphLines = await Promise.all(
      paragraphLines.map(async (paragraphLine) => {
        const trimmedLine = paragraphLine.trim();
        if (!trimmedLine) return paragraphLine;
        return translateInlinePreservingMarkdown(trimmedLine, targetLang, sourceLang);
      })
    );
    translatedLines.push(translatedParagraphLines.join("\n"));
  }

  return translatedLines.join("\n");
}

export async function translateMany(
  texts: string[],
  targetLang: string,
  sourceLang = "en"
): Promise<string[]> {
  return Promise.all(texts.map((text) => translateText(text, targetLang, sourceLang)));
}
