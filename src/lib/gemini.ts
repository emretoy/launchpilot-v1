import type { ScoringResult, Recommendation, CrawlResult, SSLInfo, HTMLValidationResult } from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function generateAISummary(
  scoring: ScoringResult,
  recommendations: Recommendation[],
  crawl: CrawlResult,
  ssl?: SSLInfo,
  htmlValidation?: HTMLValidationResult
): Promise<{ text: string | null; prompt: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: null, prompt: "" };

  const robotsTxt = crawl.technical.robotsTxtContent?.toLowerCase() || "";
  const robotsBlockAll = robotsTxt.includes("disallow: /") && !robotsTxt.includes("disallow: /.");
  const noindex = crawl.metaSEO.robots?.toLowerCase().includes("noindex") || false;

  const prompt = `Sen bir "site sağlık asistanısın". AŞAĞIDAKİ VERİLER DIŞINDA HİÇBİR ŞEY UYDURMA.
Sadece verilen metriklere dayanarak, aileye basit dille "neden bu uyarılar var"ı anlat.

VERİLER:
- Site: ${crawl.basicInfo.title || "veri yok"}
- URL: ${crawl.basicInfo.finalUrl}
- Genel Skor: ${scoring.overall}/100
- Performans: ${scoring.categories.performance.score}/100
- SEO: ${scoring.categories.seo.score}/100
- Güvenlik: ${scoring.categories.security.score}/100
- Erişilebilirlik: ${scoring.categories.accessibility.score}/100
- Best Practices: ${scoring.categories.bestPractices.score}/100
- Domain Güven: ${scoring.categories.domainTrust.score}/100
- İçerik: ${scoring.categories.content.score}/100
- Teknoloji: ${scoring.categories.technology.score}/100
- HTTPS: ${crawl.security.isHttps ? "var" : "yok"}
- SSL geçerli: ${ssl ? (ssl.valid ? "evet" : "hayır") : "veri yok"}
- noindex: ${noindex ? "evet — arama motorları görmez" : "hayır"}
- Robots tüm siteyi engelliyor: ${robotsBlockAll ? "evet" : "hayır"}
- Kelime sayısı: ${crawl.content.wordCount}
- TTFB (ms): ${scoring.categories.performance.details.find(d => d.includes("TTFB")) || "veri yok"}
- HTML hata sayısı: ${htmlValidation ? htmlValidation.errors : "veri yok"}
- Sitemap var: ${crawl.technical.hasSitemap ? "evet" : "hayır"}
- Canonical var: ${crawl.metaSEO.canonical ? "evet" : "hayır"}
- Title var: ${crawl.basicInfo.title ? "evet" : "hayır"}
- Meta description var: ${crawl.basicInfo.metaDescription ? "evet" : "hayır"}

SEO KILAVUZU (Reddit 958 yorum konsensüsü):
- Intent: Hedef kelimeyi ara, top 5 sonucu incele, hepsinde ortak format = intent
- Topical Authority: 1 pillar + 5-10 destek içerik zorunlu, support içerikler bağlantılı olmalı
- Teknik: Robots, sitemap, canonical yoksa oyun dışı. Indexlenebilirlik = 0. gün
- Güven: Dış kaynak referansı, yazar bilgisi, gerçek örnekler güven sinyali
- Backlink: Kalite > sayı. Rekabetli nişlerde backlink şart
- Content Refresh: 30-60 günde bir. Başlık, kaynak, tarih yenilenmeli
- Otorite Skoru: Intent(20) + Topical Authority(20) + Teknik(20) + Güven(20) + Backlink(20) = 100

YAZIM KURALLARI:
- Çok basit Türkçe, teknik kelime kullanma
- 10–15 kısa cümle
- SEO otorite değerlendirmesi yap: Teknik temel, içerik derinliği, güven sinyalleri
- Kılavuz kurallarına göre en kritik 3 eksikliği belirt
- "Reddit SEO topluluğuna göre..." kalıbıyla en az 1 içgörü paylaş
- Plan veya yapılacaklar listesi verme
- Her cümlede en az 1 somut veri kullan
- Veri yoksa "veri yok" de, uydurma
- "Siteniz" diye hitap et`;

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text());
      return { text: null, prompt };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { text: text?.trim() || null, prompt };
  } catch (err) {
    console.error("Gemini AI summary error:", err);
    return { text: null, prompt };
  }
}
