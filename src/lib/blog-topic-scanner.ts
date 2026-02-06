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
  description: string;
  source: string;
  sourceDetail: string;
  relevanceScore: number;
  difficulty: "Kolay" | "Orta" | "Zor";
  estimated_search_demand: "Düşük" | "Orta" | "Yüksek";
  suggestedFormat: string;
  category: string;
  keywords: string[];
  sourceEvidence: { text: string; source: string; url: string }[];
  // v2.3 fields
  content_type: "pillar" | "standalone";
  sub_topics: string[];
  is_niche_opportunity: boolean;
  funnel_stage: "TOFU" | "MOFU" | "BOFU";
  search_intent: "informational" | "commercial" | "navigational" | "transactional";
  target_persona: string;
  suggested_cta: string;
  best_publishing_quarter: "Q1" | "Q2" | "Q3" | "Q4" | "Evergreen";
}

interface GeminiResponseMetadata {
  site: string;
  content_language: string;
  total_topics: number;
  pillar_count: number;
  standalone_count: number;
  niche_opportunities: number;
  funnel_distribution: { tofu: number; mofu: number; bofu: number };
  category_count: number;
}

// ── Constants ──

const SERPER_SEARCH_URL = "https://google.serper.dev/search";
const SERPER_AUTOCOMPLETE_URL = "https://google.serper.dev/autocomplete";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ── Main Export ──

export async function scanBlogTopics(
  request: BlogTopicScanRequest,
  existingTopicTitles?: string[]
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
  const gl = resolveCountryCode(request);

  console.log(`Blog topic scan seeds (${seeds.length}): ${seeds.join(", ")}`);

  // Paralel veri toplama
  const [autocompleteResult, paaResult, redditResult, competitorResult, trendsResult] =
    await Promise.allSettled([
      fetchAutocomplete(seeds, request.language, gl, serperKey),
      fetchSearchPAA(seeds, request.language, gl, serperKey),
      fetchRedditTopics(seeds, request.language, gl, serperKey),
      fetchCompetitorTopics(seeds, request.language, gl, serperKey),
      fetchGoogleTrends(request.industry, gl, request.language),
    ]);

  const rawData: RawDataBundle = {
    autocomplete: autocompleteResult.status === "fulfilled" ? autocompleteResult.value : [],
    paa: paaResult.status === "fulfilled" ? paaResult.value : [],
    reddit: redditResult.status === "fulfilled" ? redditResult.value : [],
    competitor: competitorResult.status === "fulfilled" ? competitorResult.value : [],
    trends: trendsResult.status === "fulfilled" ? trendsResult.value : [],
  };

  console.log(`Kaynak sonuçları: autocomplete=${rawData.autocomplete.length}, paa=${rawData.paa.length}, reddit=${rawData.reddit.length}, competitor=${rawData.competitor.length}, trends=${rawData.trends.length}`);

  // Gemini sentez
  const { topics, prompt: scanPrompt, metadata } = await synthesizeWithGemini(rawData, request, geminiKey, existingTopicTitles);

  const scanDuration = Date.now() - start;

  return {
    topics,
    metadata: metadata || undefined,
    sourceStats: {
      autocomplete: rawData.autocomplete.length,
      paa: rawData.paa.length,
      reddit: rawData.reddit.length,
      competitor: rawData.competitor.length,
      trends: rawData.trends.length,
      ai: topics.length,
    },
    scanDuration,
    _prompt: scanPrompt,
  };
}

// ── Seed Keyword Generator ──

function generateSeedKeywords(request: BlogTopicScanRequest): string[] {
  const { industry, siteType, language, observedKeywords, priorityTopics } = request;

  // 1. DNA'dan gelen gerçek keyword'ler (en yüksek öncelik)
  const dnaKeywords = [
    ...(observedKeywords || []),
    ...(priorityTopics || []),
  ];
  // Deduplicate + boşlukları temizle
  const uniqueDnaKeywords = [...new Set(
    dnaKeywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 2)
  )];

  // 2. DNA keyword'leri varsa bunları seed olarak kullan
  if (uniqueDnaKeywords.length >= 3) {
    // DNA keyword'leri + industry fallback, max 10
    const seeds = [...uniqueDnaKeywords];
    if (!seeds.some(s => s.includes(industry.toLowerCase()))) {
      seeds.push(industry);
    }
    return seeds.slice(0, 10);
  }

  // 3. Fallback: eski generic yöntem (DNA keyword yoksa)
  const seeds: string[] = [...uniqueDnaKeywords, industry];

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

  return [...new Set(seeds)].slice(0, 10);
}

// ── Market Scope → Serper GL Code ──

function resolveCountryCode(request: BlogTopicScanRequest): string {
  // marketScope varsa daha doğru gl parametresi üret
  if (request.country) return request.country;
  const scope = request.marketScope?.toLowerCase();
  if (scope === "local" || scope === "national") {
    // language'dan tahmin
    if (request.language === "tr") return "tr";
    if (request.language === "de") return "de";
    if (request.language === "fr") return "fr";
  }
  return "us"; // global default
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
  const queries = seeds.slice(0, 8);
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
  country: string,
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
      serperRequest(SERPER_SEARCH_URL, { q, gl: country, hl: language, num: 10 }, apiKey)
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
  country: string,
  language: string
): Promise<RawTopic[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return [];

  try {
    const year = new Date().getFullYear();
    const query = `${industry} trend ${year}`;

    const data = await serperRequest(
      SERPER_SEARCH_URL,
      { q: query, gl: country, hl: language, num: 10 },
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
  apiKey: string,
  existingTopicTitles?: string[]
): Promise<{ topics: BlogTopic[]; prompt: string; metadata?: GeminiResponseMetadata }> {
  const allRaw = [
    ...rawData.autocomplete,
    ...rawData.paa,
    ...rawData.reddit,
    ...rawData.competitor,
    ...rawData.trends,
  ];

  const hasRawData = allRaw.length > 0;

  // Ham verileri kategorize et (her kategoriden max 20)
  const formatRawData = (items: RawTopic[], label: string, sourceKey: string) => {
    if (items.length === 0) return "";
    const limited = items.slice(0, 20);
    return `\n### ${label}\n${limited.map((i) =>
      `- [${sourceKey}] ${i.text}${i.sourceDetail && i.sourceDetail.startsWith("http") ? ` (${i.sourceDetail})` : ""}`
    ).join("\n")}`;
  };

  const rawDataText = [
    formatRawData(rawData.autocomplete, "Google Autocomplete Önerileri", "autocomplete"),
    formatRawData(rawData.paa, "People Also Ask + Related Searches", "paa"),
    formatRawData(rawData.reddit, "Reddit Tartışmaları", "reddit"),
    formatRawData(rawData.competitor, "Rakip Blog Başlıkları", "competitor"),
    formatRawData(rawData.trends, "Google Trends", "trends"),
  ]
    .filter(Boolean)
    .join("\n");

  // Exclusion listesi
  const exclusionText = existingTopicTitles && existingTopicTitles.length > 0
    ? `\n\nMEVCUT KONULAR (bunları tekrar önerme, yeni/farklı konular bul):\n${existingTopicTitles.map((t) => `- ${t}`).join("\n")}`
    : "";

  // DNA analiz JSON'ını oluştur
  const dnaAnalysisJSON = JSON.stringify({
    brand: request.brandName,
    industry: request.industry,
    site_type: request.siteType,
    content_language: request.language === "tr" ? "Türkçe" : request.language === "en" ? "English" : request.language,
    blog_authority_score: request.blogAuthorityScore,
    summary: request.dnaSummary,
    priority_topics: request.priorityTopics || [],
    topics_to_avoid: request.topicsToAvoid || [],
    observed_keywords: request.observedKeywords || [],
    market_scope: request.marketScope || "unknown",
  }, null, 2);

  const prompt = `Sen bir blog stratejistisin. Aşağıdaki iki kaynağı kullanarak bu site için en uygun blog konularını üret:
1. Site DNA Analizi — sitenin iş modeli, hedef kitlesi, tonu ve blog stratejisi
2. Ham Veri — autocomplete, PAA, Reddit, rakip analizi ve trend verilerinden toplanan konu sinyalleri

═══════════════════════════════════════
SİTE DNA ANALİZİ
═══════════════════════════════════════
${dnaAnalysisJSON}

Bu analizi AKTİF OLARAK KULLAN:
- target_audience → konu KİME yazılıyor, buna göre başlık ve derinlik belirle
- awareness_level → kitle farkındalık seviyesine göre konu tonu ve derinliği değişir
- funnel_focus → TOFU/MOFU/BOFU dağılımını buna göre ayarla
- tone_and_voice.recommended_blog_tone → başlık tonu bununla uyumlu olmalı
- blog_strategy_verdict.priority_topics → bunlar ÖNCELİKLİ konulardır, ilk sırada üret
- blog_strategy_verdict.topics_to_avoid → bu konuları KESİNLİKLE ÜRETME
- cta_structure.recommended_blog_cta → genel CTA budur, ama her konunun suggested_cta'sı farklı olabilir
- revenue_model.sales_cycle → kısa döngüde hızlı aksiyon konuları, uzun döngüde eğitici seriler
- target_audience.buyer_persona → her konunun target_persona'sı bununla uyumlu olmalı

Awareness Level Referansı:
  - Unaware → Kitle problemin farkında değil. Eğitici, merak uyandıran içerik.
  - Problem-Aware → Problemi biliyor ama çözümü bilmiyor. Problem odaklı içerik.
  - Solution-Aware → Çözümleri araştırıyor. Karşılaştırma ve rehber içerik.
  - Product-Aware → Bu firmayı değerlendiriyor. Ürün odaklı, güven inşa eden içerik.
  DNA'da awareness_level yoksa varsayılan: Problem-Aware

═══════════════════════════════════════
HAM VERİ (Otomatik Toplanan)
═══════════════════════════════════════
${hasRawData ? `${allRaw.length} öğe toplandı:\n${rawDataText}` : "Kaynaklardan veri alınamadı. Sektör bilgisine ve site DNA'sına göre konu üret."}${exclusionText}

═══════════════════════════════════════
GÖREV
═══════════════════════════════════════
Ham verileri analiz et ve site DNA'sıyla uyumlu blog konuları üret.

Konu sayısı:
- Kaliteli konu sayısı kaçsa o kadar üret.
- Minimum 30 konu.
- Üst sınır yok ama dolgu yaparak zorla sayı şişirme.
- Her konu benzersiz bir arama niyetine (search intent) karşılık gelmeli.
- Aynı niyete hizmet eden konuları BİRLEŞTİR, ayrı konu yapma.

Semantik Yakınlık: Birbirine çok yakın konuları tek bir "Pillar Content"
(Sütun İçerik) altında topla. Pillar konularda content_type: "pillar" yap
ve sub_topics dizisine alt konu başlıklarını yaz. Bağımsız konularda
content_type: "standalone" yap ve sub_topics boş dizi [] olsun.

Niche Fırsatları: Ham veride (Reddit/Competitor) güçlü sinyal veren ama
DNA analizindeki priority_topics listesinde olmayan konulara
is_niche_opportunity: true ekle.

Funnel dağılımı:
- TOFU (farkındalık): %40-50 — eğitici, bilgilendirici, geniş kitle
- MOFU (değerlendirme): %30-35 — karşılaştırma, nasıl yapılır, detaylı rehber
- BOFU (karar): %15-25 — ürün odaklı, vaka çalışması, satın alma rehberi

═══════════════════════════════════════
ÇIKTI FORMATI
═══════════════════════════════════════
Sadece JSON döndür, başka bir şey yazma:

{
  "metadata": {
    "site": "${request.domain}",
    "content_language": "${request.language}",
    "total_topics": 0,
    "pillar_count": 0,
    "standalone_count": 0,
    "niche_opportunities": 0,
    "funnel_distribution": { "tofu": 0, "mofu": 0, "bofu": 0 },
    "category_count": 0
  },
  "topics": [
    {
      "title": "Blog başlığı",
      "description": "1 cümle konu özeti — kısa tut",
      "category": "Kategori adı",
      "content_type": "pillar | standalone",
      "sub_topics": ["Alt konu 1", "Alt konu 2"],
      "is_niche_opportunity": false,
      "funnel_stage": "TOFU | MOFU | BOFU",
      "search_intent": "informational | commercial | navigational | transactional",
      "target_persona": "Bu yazı kime hitap ediyor — max 10 kelime",
      "suggested_cta": "Bu yazının sonunda hangi CTA olmalı — max 10 kelime",
      "best_publishing_quarter": "Q1 | Q2 | Q3 | Q4 | Evergreen",
      "source": "autocomplete | paa | reddit | competitor | trends | ai",
      "sourceDetail": "Max 10 kelime — kısa ve öz",
      "relevanceScore": 8,
      "difficulty": "Kolay | Orta | Zor",
      "estimated_search_demand": "Düşük | Orta | Yüksek",
      "suggestedFormat": "problem-solution | rehber | vaka-calismasi | karsilastirma | kontrol-listesi | sss | liste | hikaye | teknik-analiz",
      "keywords": ["max", "3", "adet"],
      "sourceEvidence": [
        { "text": "orijinal ham veri metni — birebir kopyala", "source": "autocomplete | paa | reddit | competitor | trends", "url": "" }
      ]
    }
  ]
}

═══════════════════════════════════════
KURALLAR
═══════════════════════════════════════

Genel:
  - Sadece JSON döndür, açıklama/yorum/ekstra metin yazma.
  - Konuları 8-12 kategoriye grupla.
  - keywords dizisi en fazla 3 eleman içersin.
  - description alanı en fazla 1 cümle — gereksiz uzatma.

JSON Veri Tipleri (KRİTİK — otomasyon için):
  - Tüm string alanları her zaman string döndür, asla null yapma. Değer yoksa boş string "" yaz.
  - url alanı: URL varsa yaz, yoksa "" (boş string). Asla null yapma.
  - sub_topics: Pillar konularda dolu dizi, standalone'da boş dizi []. Asla null yapma.
  - sourceEvidence: Kaynak yoksa boş dizi []. Asla null yapma.
  - Boolean alanlar: true veya false, asla null.
  - Sayısal alanlar: 0-10 arası integer, asla null.

Metadata Tutarlılığı:
  - total_topics = topics dizisinin uzunluğu
  - pillar_count + standalone_count = total_topics OLMALI
  - funnel_distribution.tofu/mofu/bofu = ilgili funnel_stage sayıları
  - category_count = benzersiz category değerlerinin sayısı

Kategori Kuralları:
  - YASAK kategoriler: "Genel", "Diğer", "Blog", "Çeşitli", "Karışık", "Misc", "Other", "General"
  - Her kategoride en az 2 konu olmalı.

Pillar Content Kuralları:
  - 3+ yakın konu tek bir pillar altında toplanmalı.
  - sub_topics en fazla 5 alt konu içersin.
  - Pillar sayısı toplam konuların %20-30'unu GEÇEMEZ.

Niche Opportunity Kuralları:
  - Ham veride 2+ kaynaktan sinyal gelen ama DNA priority'de olmayan konular → is_niche_opportunity: true

BOFU Kuralları:
  - BOFU konular doğrudan bir aksiyon adımına yönlendirmeli.
  - Salt bilgilendirici konu BOFU olamaz — onu TOFU veya MOFU yap.

Persona Kuralları:
  - B2B → iş rolü: "Satın alma müdürleri", "IT yöneticileri"
  - B2C → yaşam durumu: "Ev sahipleri", "Bütçe bilinçli aileler"
  - Max 10 kelime.

CTA Kuralları:
  - Konuya ÖZEL CTA üret:
    TOFU → "E-bültene katıl", "Rehberi indir"
    MOFU → "Karşılaştırma tablosunu gör", "Ücretsiz danışmanlık al"
    BOFU → "Fiyat teklifi al", "Demo talep et", "WhatsApp'tan fiyat sor"
  - Max 10 kelime.

Sezonsellik: Çoğu konu Evergreen. Sezonsellik SADECE net bağlantı varsa.

Kaynak Kuralları:
  - sourceDetail MAX 10 KELİME. AI konularda: "Esinlenme: [kısa özet]"
  - sourceEvidence: 1-3 orijinal ham veri birebir kopyala.

Zorluk: Kolay (800-1200 kelime), Orta (1500-2500), Zor (3000+).

Dil: ${request.language === "tr" ? "Tüm başlıklar ve açıklamalar Türkçe olmalı" : "All titles and descriptions must be in English"}`;

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 65536,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(120000),
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
  let parsed: { metadata?: GeminiResponseMetadata; topics: GeminiTopicOutput[] };
  try {
    parsed = JSON.parse(text);
  } catch {
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
    search_volume: validateSearchVolume(t.estimated_search_demand),
    category: t.category || null,
    keywords: Array.isArray(t.keywords) ? t.keywords : [],
    suggested_format: t.suggestedFormat || null,
    source_evidence: Array.isArray(t.sourceEvidence) ? t.sourceEvidence : null,
    country: request.country,
    language: request.language,
    status: "suggested" as const,
    planned_date: null,
    scan_id: null,
    created_at: new Date().toISOString(),
    // v2.3 fields
    content_type: t.content_type === "pillar" ? "pillar" : "standalone",
    sub_topics: Array.isArray(t.sub_topics) ? t.sub_topics : [],
    is_niche_opportunity: t.is_niche_opportunity === true,
    funnel_stage: validateFunnelStage(t.funnel_stage),
    search_intent: validateSearchIntent(t.search_intent),
    target_persona: t.target_persona || "",
    suggested_cta: t.suggested_cta || "",
    best_publishing_quarter: validateQuarter(t.best_publishing_quarter),
  }));

  return { topics, prompt, metadata: parsed.metadata };
}

// ── JSON Repair (kesik Gemini yanıtlarını kurtarır) ──

function repairAndParseJSON(text: string): { metadata?: GeminiResponseMetadata; topics: GeminiTopicOutput[] } {
  // 1. Code block içinde olabilir
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  let json = codeBlockMatch ? codeBlockMatch[1] : text;

  // 2. Doğrudan parse dene
  try {
    return JSON.parse(json);
  } catch {
    // devam
  }

  // 3. Bracket-balance repair: son tam objeye kadar kes, kapatmaları ekle
  const lastCompleteObject = json.lastIndexOf("}");
  if (lastCompleteObject !== -1) {
    let trimmed = json.substring(0, lastCompleteObject + 1);
    trimmed = trimmed.replace(/,\s*$/, "");

    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;

    for (let i = 0; i < openBrackets - closeBrackets; i++) trimmed += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) trimmed += "}";

    try {
      const result = JSON.parse(trimmed);
      console.log(`JSON repair (bracket-balance) başarılı — ${result.topics?.length || 0} konu kurtarıldı.`);
      return result;
    } catch {
      // devam — obje bazlı kurtarma dene
    }
  }

  // 4. Obje bazlı kurtarma: her topic objesini regex ile çıkar
  const topicObjects: GeminiTopicOutput[] = [];
  // "title" alanı olan her {...} bloğunu bul
  const objectRegex = /\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match;
  while ((match = objectRegex.exec(json)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.title) topicObjects.push(obj);
    } catch {
      // Bu obje parse edilemedi, atla
    }
  }

  if (topicObjects.length > 0) {
    console.log(`JSON repair (obje-bazlı) başarılı — ${topicObjects.length} konu kurtarıldı.`);
    return { topics: topicObjects };
  }

  // 5. Son çare: satır satır "title" içeren JSON objeleri ara
  const lines = json.split("\n");
  let buffer = "";
  let braceDepth = 0;
  let inObject = false;

  for (const line of lines) {
    for (const ch of line) {
      if (ch === "{") {
        if (braceDepth === 1) { inObject = true; buffer = "{"; }
        braceDepth++;
      } else if (ch === "}") {
        braceDepth--;
        if (inObject) {
          buffer += ch;
          if (braceDepth <= 1) {
            try {
              const obj = JSON.parse(buffer);
              if (obj.title) topicObjects.push(obj);
            } catch { /* atla */ }
            inObject = false;
            buffer = "";
          }
        }
      } else if (inObject) {
        buffer += ch;
      }
    }
    if (inObject) buffer += "\n";
  }

  if (topicObjects.length > 0) {
    console.log(`JSON repair (satır-bazlı) başarılı — ${topicObjects.length} konu kurtarıldı.`);
    return { topics: topicObjects };
  }

  console.error("JSON repair başarısız. Ham yanıt (ilk 500 karakter):", json.substring(0, 500));
  throw new Error("Gemini yanıtı repair edildikten sonra da parse edilemedi.");
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

function validateFunnelStage(val: string): "TOFU" | "MOFU" | "BOFU" {
  if (val === "TOFU" || val === "MOFU" || val === "BOFU") return val;
  return "TOFU";
}

function validateSearchIntent(val: string): "informational" | "commercial" | "navigational" | "transactional" {
  const valid = ["informational", "commercial", "navigational", "transactional"] as const;
  if (valid.includes(val as typeof valid[number])) return val as typeof valid[number];
  return "informational";
}

function validateQuarter(val: string): "Q1" | "Q2" | "Q3" | "Q4" | "Evergreen" {
  const valid = ["Q1", "Q2", "Q3", "Q4", "Evergreen"] as const;
  if (valid.includes(val as typeof valid[number])) return val as typeof valid[number];
  return "Evergreen";
}
