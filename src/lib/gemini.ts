import type { ScoringResult, Recommendation, CrawlResult, SSLInfo, HTMLValidationResult, WebsiteDNA } from "./types";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function generateAISummary(
  scoring: ScoringResult,
  recommendations: Recommendation[],
  crawl: CrawlResult,
  ssl?: SSLInfo,
  htmlValidation?: HTMLValidationResult,
  dna?: WebsiteDNA
): Promise<{ text: string | null; prompt: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { text: null, prompt: "" };

  // Build crawl data for the prompt
  const robotsTxt = crawl.technical.robotsTxtContent?.toLowerCase() || "";
  const robotsBlockAll = robotsTxt.includes("disallow: /") && !robotsTxt.includes("disallow: /.");
  const noindex = crawl.metaSEO.robots?.toLowerCase().includes("noindex") || false;

  const dnaContext = dna ? `
- Site Türü: ${dna.identity.siteType || "bilinmiyor"}
- Sektör: ${dna.identity.industry || "bilinmiyor"}
- Olgunluk: ${dna.maturity.level || "bilinmiyor"}
- Hedef Kitle: ${dna.targetMarket.audience || "bilinmiyor"}
- Blog var mı: ${dna.contentStructure.hasBlog ? "evet" : "hayır"}
- E-ticaret var mı: ${dna.contentStructure.hasEcommerce ? "evet" : "hayır"}` : "";

  const crawlData = `- Site: ${crawl.basicInfo.title || "veri yok"}
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
- SSL son kullanma: ${ssl?.expiresAt || "veri yok"}
- noindex: ${noindex ? "evet — arama motorları görmez" : "hayır"}
- Robots tüm siteyi engelliyor: ${robotsBlockAll ? "evet" : "hayır"}
- Kelime sayısı: ${crawl.content.wordCount}
- TTFB (ms): ${scoring.categories.performance.details.find(d => d.includes("TTFB")) || "veri yok"}
- HTML hata sayısı: ${htmlValidation ? htmlValidation.errors : "veri yok"}
- HTML uyarı sayısı: ${htmlValidation ? htmlValidation.warnings : "veri yok"}
- Sitemap var: ${crawl.technical.hasSitemap ? "evet" : "hayır"}
- Sitemap sayfa sayısı: ${crawl.technical.sitemapPageCount ?? "veri yok"}
- Canonical var: ${crawl.metaSEO.canonical ? "evet" : "hayır"}
- Title var: ${crawl.basicInfo.title ? "evet" : "hayır"}
- Meta description var: ${crawl.basicInfo.metaDescription ? "evet" : "hayır"}
- H1 sayısı: ${crawl.headings.totalH1}
- H1 içerikleri: ${crawl.headings.h1.map(h => h.text).join(", ") || "yok"}
- Viewport meta: ${crawl.metaSEO.viewport ? "var" : "yok"}
- Mixed content: ${crawl.security.hasMixedContent ? "var" : "yok"}
- Schema türleri: ${crawl.technical.schemaTypes.join(", ") || "yok"}
- Toplam iç link: ${crawl.links.totalInternal}
- Toplam dış link: ${crawl.links.totalExternal}
- Kırık link: ${crawl.links.totalBroken}
- Toplam görsel: ${crawl.images.total}
- Alt tag eksik görsel: ${crawl.images.totalMissingAlt}
- Robots.txt var: ${crawl.technical.hasRobotsTxt ? "evet" : "hayır"}
- Dil: ${crawl.basicInfo.language || "veri yok"}
- Hreflang: ${crawl.metaSEO.hreflang.length > 0 ? crawl.metaSEO.hreflang.map(h => h.lang).join(", ") : "yok"}${dnaContext}`;

  const prompt = `Sen bir teknik site sağlık uzmanısın.
AŞAĞIDAKİ VERİLER DIŞINDA HİÇBİR ŞEY UYDURMA.

⚠️ Bu rapor JSON değildir. Serbest metin rapor üret.

Teknik sorunları ve hataları özetle. Sitenin ne olduğunu anlatma —
sadece teknik sağlık durumunu, performans sorunlarını, SEO eksiklerini
ve güvenlik açıklarını analiz et.

═══════════════════════════════════════
SİTE VERİLERİ (Otomatik Tarama)
═══════════════════════════════════════
Aşağıdaki veriler otomatik crawl ile elde edilmiştir.
Veri yoksa "veri yok" de, UYDURMA.
Crawl verisinde olmayan metrikleri tahmin etme.

${crawlData}

═══════════════════════════════════════
ANALİZ KAPSAMI
═══════════════════════════════════════
Aşağıdaki 4 alanı analiz et. Her alan için SADECE crawl verisinde
karşılığı olan sorunları raporla:

1. PERFORMANS
   - Sayfa yükleme hızı, Core Web Vitals (LCP, INP, CLS)
     Not: FID artık INP (Interaction to Next Paint) ile değiştirilmiştir.
     Crawl verisinde FID varsa raporla ama INP'nin güncel metrik olduğunu belirt.
   - Toplam sayfa boyutu, render-blocking kaynaklar
   - Görsel optimizasyon: format (WebP mi PNG/JPG mi?), boyut,
     sıkıştırma durumu — LCP'nin en yaygın sebebi optimize edilmemiş görsellerdir
   - Mobil uyumluluk: SADECE crawl verisinde açıkça belirtilmişse değerlendir.
     Viewport meta tag varlığı tek başına mobil uyumluluk kanıtı DEĞİLDİR.
     Veri yoksa: "Mobil uyumluluk verisi mevcut değil"
   - Veri yoksa: "Performans verisi mevcut değil"

2. SEO TEMELLERİ
   - robots.txt durumu (var/yok/hatalı)
   - sitemap.xml durumu (var/yok/hatalı)
   - Canonical tag kullanımı
   - Meta title ve description durumu (eksik/tekrar/çok uzun/çok kısa)
   - H1 yapısı (eksik/birden fazla/uyumsuz)
   - Yapılandırılmış veri (schema markup) durumu
   - HTTP durum kodları: 404 hataları, 301 yönlendirme zincirleri,
     500 sunucu hataları — bunlar tarama bütçesini (crawl budget) tüketir
   - Veri yoksa: "SEO teknik verisi mevcut değil"

3. GÜVENLİK
   - SSL/HTTPS durumu
   - Mixed content uyarıları
   - Güvenlik header'ları (X-Frame-Options, CSP vb.)
   - Veri yoksa: "Güvenlik verisi mevcut değil"

4. ERİŞİLEBİLİRLİK & KOD KALİTESİ
   - Alt tag eksikleri (görsellerde açıklama metni)
   - Kırık linkler (404)
   - Konsol hataları
   - Veri yoksa: "Erişilebilirlik verisi mevcut değil"

═══════════════════════════════════════
SEO OTORİTE DEĞERLENDİRMESİ
═══════════════════════════════════════
Aşağıdaki 5 kritere göre otorite skoru hesapla.
Her kriter 20 puan, toplam 100.
SADECE crawl verisinden çıkarılabilecek kriterleri puanla.
Veri olmayan kriterlere "veri yok" yaz ve 0 puan ver.

| Kriter | Max | Nasıl Puanla |
|--------|-----|--------------|
| Arama Niyeti Uyumu (Intent) | 20 | Meta title/description hedef kelimeye uyumlu mu? Sayfa yapısı arama niyetini karşılıyor mu? |
| İçerik Derinliği (Topical Authority) | 20 | Blog var mı? Kaç yazı? Konular birbiriyle bağlantılı mı? Pillar-cluster yapısı var mı? |
| Teknik Temel | 20 | robots.txt + sitemap + canonical + SSL + hız + mobil uyumluluk + HTTP hata durumu. Puan, mevcut alt metriklerin olumlu/olumsuz oranına göre verilir. Örn: 6 alt metrikten 4'ü olumlu = 14/20 |
| Güven Sinyalleri | 20 | Yazar bilgisi, referanslar, sertifikalar, müşteri yorumları, iletişim bilgileri. SADECE crawl'da açıkça görünen öğelere dayanır, varsayım yapılmaz. |
| Dış Bağlantı (Backlink) | 20 | Crawl verisinde backlink datası varsa puanla. YOKSA "Backlink verisi mevcut değil, 0 puan" yaz. Backlink verisi olmadan "zayıf profil", "güçlü profil" gibi YORUM YAPMA. |

Toplam: X/100 (veri olmayan kriterler 0 sayılır, bunu belirt)

Skor bölümünde her kriterin yanına kısa bir "neden önemli" notu ekle:
  Örnek: "Teknik Temel: 14/20 — robots.txt ve sitemap mevcut ama
  canonical eksik (aynı içeriğin farklı URL'lerde görünmesine yol açar,
  Google sıralama gücünü böler)"

Reddit SEO Konsensüsü Referansları:
- Robots, sitemap, canonical yoksa indexlenebilirlik sıfırdır
- Topical authority: 1 pillar + 5-10 destek içerik zorunlu
- Backlink'te kalite > sayı
- İçerik 30-60 günde bir yenilenmeli
- Dış kaynak referansı ve yazar bilgisi güven sinyalidir
Reddit referansını SADECE raporun sonundaki skor bölümünde,
bir tespiti desteklemek için kullan. Raporun ana gövdesine
Reddit yorumu karıştırma.
Format: "Reddit SEO topluluğuna göre, [kısa tespit]."

═══════════════════════════════════════
ÇIKTI FORMATI
═══════════════════════════════════════
Aşağıdaki yapıyı AYNEN kullan. Başlıkları değiştirme.
Her bölümde 3-5 kısa cümle yaz.

---
📊 PERFORMANS
[3-5 cümle — somut veri ile]

🔍 SEO TEMELLERİ
[3-5 cümle — somut veri ile]

🔒 GÜVENLİK
[3-5 cümle — somut veri ile]

♿ ERİŞİLEBİLİRLİK
[3-5 cümle — somut veri ile]

⚠️ EN KRİTİK 3 SORUN
Sorunları şu öncelik sırasına göre seç:
  1. 🔴 [High] İndekslenmeyi veya erişimi engelleyen sorun
  2. 🟡 [Medium] Kullanıcı deneyimini bozan sorun
  3. 🟢 [Low] İyileştirme fırsatı olan sorun
Her sorunun yanına somut veri ekle.

📈 SEO OTORİTE SKORU: X/100
- Intent: X/20 — (neden önemli: kısa açıklama)
- İçerik Derinliği: X/20 — (neden önemli: kısa açıklama)
- Teknik: X/20 — (neden önemli: kısa açıklama)
- Güven: X/20 — (neden önemli: kısa açıklama)
- Backlink: X/20 — (neden önemli: kısa açıklama)
[1 cümle — Reddit referansı ile en kritik içgörü]
---

═══════════════════════════════════════
YAZIM KURALLARI
═══════════════════════════════════════
- Sade Türkçe yaz. Teknik terimler kullanabilirsin ama
  yanına parantez içinde kısa açıklama ekle.
  Örnek: "robots.txt (arama motorlarının site haritası) bulunamadı"
  Örnek: "LCP (en büyük içerik yüklenme süresi) 4.2 saniye"
- Her cümlede en az 1 somut veri veya sayı kullan.
- Veri olmayan durumlarda:
  → Yorum, tahmin veya genelleme YAPMA.
  → Sadece "veri mevcut değil" ifadesiyle cümleyi bitir.
  → "veri mevcut değil, ancak bu genellikle..." gibi devam cümleleri YASAK.
- "Siteniz" diye hitap et.
- Plan, öneri veya yapılacaklar listesi VERME.
  Sadece mevcut durumu raporla.
- Toplam çıktı 20-30 cümle arası olsun.
- Pozitif bulgu SADECE somut crawl verisiyle destekleniyorsa yaz.
  "Site çalışıyor" veya "site açılıyor" gibi zorlama pozitifler YASAK.
  Gerçek örnek: "SSL sertifikası aktif ve geçerli (son kullanma: 2025-08-15)."`;

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
        },
      }),
      signal: AbortSignal.timeout(15000),
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
