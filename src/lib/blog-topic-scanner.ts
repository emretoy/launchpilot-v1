// ── Blog Topic Scanner — 5 Veri Kaynağı + Gemini Sentez ──

import type { BlogTopicScanRequest, BlogTopicScanResult, BlogTopic } from "./types";

// ── Internal Types ──

interface RawTopic {
  text: string;
  source: "autocomplete" | "paa" | "reddit" | "competitor" | "trends";
  sourceDetail?: string;
}

interface RawDataBundle {
  autocomplete: RawTopic[];
  paa: RawTopic[];
  reddit: RawTopic[];
  competitor: RawTopic[];
  trends: RawTopic[];
}

interface GeminiTopicOutput {
  title: string;
  description: string | null;
  source: string;
  sourceDetail: string | null;
  relevanceScore: number;
  difficulty: "Kolay" | "Orta" | "Zor";
  searchVolume: "Düşük" | "Orta" | "Yüksek";
  suggestedFormat: string | null;
  category: string | null;
  keywords: string[];
}

// ── Constants ──

const SERPER_SEARCH_URL = "https://google.serper.dev/search";
const SERPER_AUTOCOMPLETE_URL = "https://google.serper.dev/autocomplete";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ── Main Export ──

export async function scanBlogTopics(
  request: BlogTopicScanRequest
): Promise<BlogTopicScanResult> {
  const start = Date.now();

  const serperKey = process.env.SERPER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!serperKey) {
    throw new Error("SERPER_API_KEY tanımlı değil. Konu taraması için gerekli.");
  }
  if (!geminiKey) {
    throw new Error("GEMINI_API_KEY tanımlı değil. Konu sentezi için gerekli.");
  }

  const seeds = generateSeedKeywords(request);

  // Paralel veri toplama
  const [autocompleteResult, paaResult, redditResult, competitorResult, trendsResult] =
    await Promise.allSettled([
      fetchAutocomplete(seeds, request.language, request.country, serperKey),
      fetchSearchPAA(seeds, request.language, request.country, serperKey),
      fetchRedditTopics(seeds, request.language, request.country, serperKey),
      fetchCompetitorTopics(seeds, request.language, serperKey),
      fetchGoogleTrends(request.industry, request.country),
    ]);

  const rawData: RawDataBundle = {
    autocomplete: autocompleteResult.status === "fulfilled" ? autocompleteResult.value : [],
    paa: paaResult.status === "fulfilled" ? paaResult.value : [],
    reddit: redditResult.status === "fulfilled" ? redditResult.value : [],
    competitor: competitorResult.status === "fulfilled" ? competitorResult.value : [],
    trends: trendsResult.status === "fulfilled" ? trendsResult.value : [],
  };

  // Gemini sentez
  const topics = await synthesizeWithGemini(rawData, request, geminiKey);

  const scanDuration = Date.now() - start;

  return {
    topics,
    sourceStats: {
      autocomplete: rawData.autocomplete.length,
      paa: rawData.paa.length,
      reddit: rawData.reddit.length,
      competitor: rawData.competitor.length,
      trends: rawData.trends.length,
      ai: topics.length,
    },
    scanDuration,
  };
}

// ── Seed Keyword Generator ──

function generateSeedKeywords(request: BlogTopicScanRequest): string[] {
  const { industry, siteType, language } = request;
  const seeds: string[] = [industry];

  // Dile göre ek kelimeler
  if (language === "tr") {
    seeds.push(`${industry} nasıl`);
    seeds.push(`${industry} rehber`);
    seeds.push(`${industry} ${new Date().getFullYear()}`);
    seeds.push(`${industry} ipuçları`);
    if (siteType !== industry) {
      seeds.push(`${siteType} ${industry}`);
    }
  } else {
    seeds.push(`${industry} how to`);
    seeds.push(`${industry} guide`);
    seeds.push(`${industry} ${new Date().getFullYear()}`);
    seeds.push(`${industry} tips`);
    if (siteType !== industry) {
      seeds.push(`${siteType} ${industry}`);
    }
  }

  return seeds.slice(0, 6);
}

// ── Serper Helper ──

async function serperRequest(
  url: string,
  body: Record<string, unknown>,
  apiKey: string
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status}`);
  }

  return res.json();
}

// ── 1. Autocomplete ──

async function fetchAutocomplete(
  seeds: string[],
  language: string,
  country: string,
  apiKey: string
): Promise<RawTopic[]> {
  const queries = seeds.slice(0, 5);
  const results: RawTopic[] = [];

  const responses = await Promise.allSettled(
    queries.map((q) =>
      serperRequest(SERPER_AUTOCOMPLETE_URL, { q, gl: country, hl: language }, apiKey)
    )
  );

  for (const res of responses) {
    if (res.status === "fulfilled") {
      const suggestions = (res.value.suggestions as { value: string }[]) || [];
      for (const s of suggestions) {
        results.push({
          text: s.value,
          source: "autocomplete",
          sourceDetail: "Google Autocomplete",
        });
      }
    }
  }

  return results;
}

// ── 2. Search + PAA + Related Searches ──

async function fetchSearchPAA(
  seeds: string[],
  language: string,
  country: string,
  apiKey: string
): Promise<RawTopic[]> {
  const suffixes =
    language === "tr"
      ? ["blog konuları", "sık sorulan sorular", `rehber ${new Date().getFullYear()}`, "ipuçları"]
      : ["blog topics", "frequently asked questions", `guide ${new Date().getFullYear()}`, "tips"];

  const queries = suffixes.map((s) => `${seeds[0]} ${s}`);
  const results: RawTopic[] = [];

  const responses = await Promise.allSettled(
    queries.map((q) =>
      serperRequest(SERPER_SEARCH_URL, { q, gl: country, hl: language, num: 10 }, apiKey)
    )
  );

  for (const res of responses) {
    if (res.status !== "fulfilled") continue;
    const data = res.value;

    // People Also Ask
    const paa = (data.peopleAlsoAsk as { question: string }[]) || [];
    for (const item of paa) {
      results.push({
        text: item.question,
        source: "paa",
        sourceDetail: "People Also Ask",
      });
    }

    // Related Searches
    const related = (data.relatedSearches as { query: string }[]) || [];
    for (const item of related) {
      results.push({
        text: item.query,
        source: "paa",
        sourceDetail: "Related Searches",
      });
    }

    // Organic titles
    const organic = (data.organic as { title: string }[]) || [];
    for (const item of organic.slice(0, 5)) {
      results.push({
        text: item.title,
        source: "paa",
        sourceDetail: "Search Results",
      });
    }
  }

  return results;
}

// ── 3. Reddit ──

async function fetchRedditTopics(
  seeds: string[],
  language: string,
  country: string,
  apiKey: string
): Promise<RawTopic[]> {
  const countryName = language === "tr" ? "türkiye" : country === "gb" ? "uk" : country;
  const suffixes =
    language === "tr"
      ? [countryName, "tavsiye", "sorun"]
      : [countryName, "recommendation", "problem"];

  const queries = suffixes.map((s) => `site:reddit.com ${seeds[0]} ${s}`);
  const results: RawTopic[] = [];

  const responses = await Promise.allSettled(
    queries.map((q) =>
      serperRequest(SERPER_SEARCH_URL, { q, gl: country, hl: language, num: 10 }, apiKey)
    )
  );

  for (const res of responses) {
    if (res.status !== "fulfilled") continue;
    const organic = (res.value.organic as { title: string; link: string }[]) || [];
    for (const item of organic) {
      results.push({
        text: item.title,
        source: "reddit",
        sourceDetail: item.link || "Reddit",
      });
    }
  }

  return results;
}

// ── 4. Competitor Analysis ──

async function fetchCompetitorTopics(
  seeds: string[],
  language: string,
  apiKey: string
): Promise<RawTopic[]> {
  const suffixes =
    language === "tr"
      ? ["blog", "en iyi yöntemler", `${new Date().getFullYear()} trendler`]
      : ["blog", "best practices", `${new Date().getFullYear()} trends`];

  const queries = suffixes.map((s) => `${seeds[0]} ${s}`);
  const results: RawTopic[] = [];

  const responses = await Promise.allSettled(
    queries.map((q) =>
      serperRequest(SERPER_SEARCH_URL, { q, hl: language, num: 10 }, apiKey)
    )
  );

  for (const res of responses) {
    if (res.status !== "fulfilled") continue;
    const organic = (res.value.organic as { title: string; link: string }[]) || [];
    for (const item of organic) {
      results.push({
        text: item.title,
        source: "competitor",
        sourceDetail: item.link || "Competitor Blog",
      });
    }
  }

  return results;
}

// ── 5. Google Trends (Serper üzerinden yaklaşık) ──

async function fetchGoogleTrends(
  industry: string,
  country: string
): Promise<RawTopic[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return [];

  try {
    const year = new Date().getFullYear();
    const query = `${industry} trend ${year}`;

    const data = await serperRequest(
      SERPER_SEARCH_URL,
      { q: query, gl: country, hl: country === "tr" ? "tr" : "en", num: 10 },
      serperKey
    );

    const results: RawTopic[] = [];
    const organic = (data.organic as { title: string }[]) || [];
    for (const item of organic) {
      results.push({
        text: item.title,
        source: "trends",
        sourceDetail: "Google Trends (Serper)",
      });
    }

    const related = (data.relatedSearches as { query: string }[]) || [];
    for (const item of related) {
      results.push({
        text: item.query,
        source: "trends",
        sourceDetail: "Google Trends (Related)",
      });
    }

    return results;
  } catch {
    console.log("Google Trends (Serper) skipped due to error");
    return [];
  }
}

// ── Gemini Sentez ──

async function synthesizeWithGemini(
  rawData: RawDataBundle,
  request: BlogTopicScanRequest,
  apiKey: string
): Promise<BlogTopic[]> {
  const allRaw = [
    ...rawData.autocomplete,
    ...rawData.paa,
    ...rawData.reddit,
    ...rawData.competitor,
    ...rawData.trends,
  ];

  if (allRaw.length === 0) {
    throw new Error("Hiçbir veri kaynağından veri alınamadı. Serper API key'i kontrol edin.");
  }

  // Ham verileri kategorize et
  const formatRawData = (items: RawTopic[], label: string) => {
    if (items.length === 0) return "";
    return `\n### ${label}\n${items.map((i) => `- ${i.text}`).join("\n")}`;
  };

  const rawDataText = [
    formatRawData(rawData.autocomplete, "Google Autocomplete Önerileri"),
    formatRawData(rawData.paa, "People Also Ask + Related Searches"),
    formatRawData(rawData.reddit, "Reddit Tartışmaları"),
    formatRawData(rawData.competitor, "Rakip Blog Başlıkları"),
    formatRawData(rawData.trends, "Google Trends"),
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Sen bir blog stratejistisin. Aşağıdaki kaynaklardan toplanan ham veriyi analiz et ve bu site için en uygun 100 blog konusu üret.

SİTE DNA:
- Marka: ${request.brandName}
- Sektör: ${request.industry}
- Site türü: ${request.siteType}
- Hedef dil: ${request.language === "tr" ? "Türkçe" : request.language === "en" ? "İngilizce" : request.language}
- Blog otorite skoru: ${request.blogAuthorityScore ?? "bilinmiyor"}/100
${request.dnaSummary ? `- AI özeti: ${request.dnaSummary}` : ""}

HAM VERİLER (${allRaw.length} öğe):
${rawDataText}

GÖREV: Bu ham verileri analiz et ve 100 benzersiz blog konusu üret.

Her konu için şu JSON formatında döndür:
{
  "topics": [
    {
      "title": "Blog başlığı",
      "description": "1-2 cümle konu özeti",
      "source": "autocomplete|paa|reddit|competitor|trends|ai",
      "sourceDetail": "Kaynağın detayı",
      "relevanceScore": 8,
      "difficulty": "Kolay|Orta|Zor",
      "searchVolume": "Düşük|Orta|Yüksek",
      "suggestedFormat": "rehber|liste|sss|karşılaştırma|hikaye|kontrol-listesi",
      "category": "Kategori adı",
      "keywords": ["anahtar", "kelime"]
    }
  ]
}

KURALLAR:
- 50-100 arası benzersiz konu üret (fazla tekrar yapma, 50 kaliteli konu 100 tekrarlıdan iyidir)
- Tekrar eden konuları birleştir
- relevanceScore (1-10): siteyle uyuma göre
- Konuları 8-12 kategoriye grupla
- Her konu için en uygun blog formatını öner
- Arama hacmi tahmini yap (ham verideki frekansa göre)
- Kaynak: ham veri hangi kaynaktan geldiyse onu yaz, kendi ürettiğin konular için "ai" yaz
- ${request.language === "tr" ? "Tüm başlıklar ve açıklamalar Türkçe olmalı" : "All titles and descriptions must be in English"}
- Kolay: kısa, giriş seviye. Orta: detaylı. Zor: kapsamlı, araştırma gerektirir
- description alanını KISA tut (en fazla 1 cümle), gereksiz uzatma
- keywords dizisi en fazla 3 eleman içersin
- Sadece JSON döndür, başka bir şey yazma`;

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 32768,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API error:", res.status, errText);
    throw new Error("Gemini API'den konu sentezi alınamadı.");
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error("Gemini boş yanıt döndü.");
  }

  // JSON parse — kesik yanıtları da kurtarmaya çalış
  let parsed: { topics: GeminiTopicOutput[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    // Kesik JSON'ı repair etmeye çalış
    parsed = repairAndParseJSON(text);
  }

  if (!parsed.topics || !Array.isArray(parsed.topics)) {
    throw new Error("Gemini yanıtında 'topics' dizisi bulunamadı.");
  }

  console.log(`Gemini ${parsed.topics.length} konu üretti.`);

  // BlogTopic formatına dönüştür (id, user_id, domain sonra API route'da doldurulacak)
  const topics: BlogTopic[] = parsed.topics.map((t) => ({
    id: "",
    user_id: "",
    domain: request.domain,
    title: t.title || "Başlıksız",
    description: t.description || null,
    source: normalizeSource(t.source),
    source_detail: t.sourceDetail || null,
    relevance_score: Math.max(1, Math.min(10, t.relevanceScore || 5)),
    difficulty: validateDifficulty(t.difficulty),
    search_volume: validateSearchVolume(t.searchVolume),
    category: t.category || null,
    keywords: Array.isArray(t.keywords) ? t.keywords : [],
    suggested_format: t.suggestedFormat || null,
    status: "suggested" as const,
    planned_date: null,
    scan_id: null,
    created_at: new Date().toISOString(),
  }));

  return topics;
}

// ── JSON Repair (kesik Gemini yanıtlarını kurtarır) ──

function repairAndParseJSON(text: string): { topics: GeminiTopicOutput[] } {
  // 1. Code block içinde olabilir
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  let json = codeBlockMatch ? codeBlockMatch[1] : text;

  // 2. Doğrudan parse dene
  try {
    return JSON.parse(json);
  } catch {
    // devam
  }

  // 3. Kesik JSON repair: son geçerli objeyi bul ve array'i kapat
  // Strateji: son tam "}" bul, sonrasını kes, "]}" ekle
  const lastCompleteObject = json.lastIndexOf("}");
  if (lastCompleteObject === -1) {
    throw new Error("Gemini yanıtı JSON olarak parse edilemedi.");
  }

  // Son complete object'e kadar kes
  let trimmed = json.substring(0, lastCompleteObject + 1);

  // Sonundaki fazla virgülü temizle
  trimmed = trimmed.replace(/,\s*$/, "");

  // topics array'ini ve root object'i kapat
  // Kaç tane açık bracket var kontrol et
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;

  // Eksik kapatmaları ekle
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    trimmed += "]";
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    trimmed += "}";
  }

  try {
    const result = JSON.parse(trimmed);
    console.log(`JSON repair başarılı — ${result.topics?.length || 0} konu kurtarıldı.`);
    return result;
  } catch {
    throw new Error("Gemini yanıtı repair edildikten sonra da parse edilemedi.");
  }
}

// ── Validation Helpers ──

function normalizeSource(source: string): string {
  const valid = ["autocomplete", "paa", "reddit", "competitor", "trends", "ai"];
  return valid.includes(source) ? source : "ai";
}

function validateDifficulty(val: string): "Kolay" | "Orta" | "Zor" {
  if (val === "Kolay" || val === "Orta" || val === "Zor") return val;
  return "Orta";
}

function validateSearchVolume(val: string): "Düşük" | "Orta" | "Yüksek" {
  if (val === "Düşük" || val === "Orta" || val === "Yüksek") return val;
  return "Orta";
}
