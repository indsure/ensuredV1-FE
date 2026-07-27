// Free MyMemory translation API — no key needed, 5000 chars/day free tier
// Results cached in sessionStorage so each string is only translated once per session

const CACHE_PREFIX = "indsure_tx_";

async function translateOne(text: string, targetLang: string): Promise<string> {
  if (!text?.trim()) return text;

  const cacheKey = `${CACHE_PREFIX}${targetLang}_${btoa(encodeURIComponent(text)).slice(0, 40)}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`;
    const res = await fetch(url);
    const json = await res.json();
    const translated: string = json?.responseData?.translatedText ?? text;
    sessionStorage.setItem(cacheKey, translated);
    return translated;
  } catch {
    return text; // fall back to original on error
  }
}

export async function translateAll(texts: string[], targetLang: string): Promise<string[]> {
  if (targetLang === "en") return texts;
  return Promise.all(texts.map((t) => translateOne(t, targetLang)));
}
