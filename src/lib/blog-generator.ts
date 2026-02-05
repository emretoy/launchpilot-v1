// ── Blog Generator — Prompt Builder + Imagen Helper + Scoring ──

// ── Interfaces ──

export interface BlogSiteContext {
  brandName: string;
  siteType: string;
  industry: string | null;
  primaryLanguage: string | null;
  platform: string | null;
  blogAuthorityScore: number | null;
}

export interface BlogRecommendation {
  recommendedFormat: BlogContentType;
  formatLabel: string;
  reasons: string[];
  recommendedLength: number;
  lengthReason: string;
}

export type BlogContentType =
  | "problem-solution"
  | "pillar"
  | "case-study"
  | "comparison"
  | "checklist"
  | "faq";

export const BLOG_FORMAT_OPTIONS: {
  value: BlogContentType;
  label: string;
  description: string;
}[] = [
  { value: "problem-solution", label: "Adım Adım Rehber", description: "Bir sorunu adım adım çözer" },
  { value: "pillar", label: "Kapsamlı Kılavuz", description: "Konuyu baştan sona anlatır" },
  { value: "case-study", label: "Başarı Hikayesi", description: "Gerçek bir deneyimi paylaşır" },
  { value: "comparison", label: "Karşılaştırma", description: "İki seçeneği yan yana koyar" },
  { value: "checklist", label: "Kontrol Listesi", description: "Yapılacakları madde madde sıralar" },
  { value: "faq", label: "Soru-Cevap", description: "En çok sorulan soruları yanıtlar" },
];

export interface BlogGenerateRequest {
  topic: string;
  format: BlogContentType;
  targetLength: number;
  siteContext: BlogSiteContext;
}

export interface BlogGenerateResult {
  blogHtml: string;
  imageDescriptions: ImagePlaceholder[];
  seoChecklist: string[];
  suggestedTitle: string;
  suggestedMetaDesc: string;
  chosenFormat: string;
  error: string | null;
}

export interface ImagePlaceholder {
  description: string;
  tone: string;
}

export interface BlogScore {
  total: number;
  level: "green" | "yellow" | "red";
  levelLabel: string;
  levelMessage: string;
  criteria: BlogScoreCriterion[];
}

export interface BlogScoreCriterion {
  label: string;
  maxScore: number;
  score: number;
  passed: boolean;
  detail: string;
}

// ── Constants ──

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const IMAGEN_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict";

// ── Topic Suggestions ──

const TOPIC_MAP: Record<string, string[]> = {
  "e-commerce": [
    "Online Alışverişte Beden Seçimi Rehberi",
    "E-Ticaret Sitesinde Güven Nasıl Kazanılır?",
    "Kargo Süreçlerini Hızlandırmanın 5 Yolu",
    "Ürün Fotoğrafı Nasıl Çekilir? Basit Rehber",
    "Müşteri Yorumları Neden Bu Kadar Önemli?",
  ],
  blog: [
    "Blog Yazısı Nasıl Yazılır? Başlangıç Rehberi",
    "SEO Dostu İçerik Üretmenin 7 Kuralı",
    "Blog Trafiğini Artırmanın Kanıtlanmış Yolları",
    "İçerik Takvimi Nasıl Oluşturulur?",
    "Blog Okuyucusunu Müşteriye Çevirmenin Yolları",
  ],
  corporate: [
    "Şirketinizi Online'da Nasıl Tanıtırsınız?",
    "Kurumsal Web Sitesinde Olması Gereken 10 Şey",
    "Müşteri Güveni Nasıl Kazanılır?",
    "Hakkımızda Sayfası Neden Önemli?",
    "Google'da Üst Sıralara Çıkmanın Temelleri",
  ],
  saas: [
    "Kullanıcı Deneyimini İyileştirmenin 5 Yolu",
    "Ücretsiz Deneme Dönüşüm Oranını Artırma Rehberi",
    "SaaS Müşteri Kaybını Azaltmanın Yolları",
    "Ürün Güncellemelerini Duyurmanın En İyi Yolları",
    "Müşteri Destek Süreçlerini Otomatikleştirme",
  ],
  portfolio: [
    "Portfolyo Sitesi Nasıl Hazırlanır?",
    "Freelancer Olarak Müşteri Bulmanın Yolları",
    "Kendi Markanızı Oluşturma Rehberi",
    "Referans ve Testimonial Nasıl Toplanır?",
    "Online Varlığınızı Güçlendirmenin 5 Adımı",
  ],
};

const INDUSTRY_TOPICS: Record<string, string[]> = {
  "kuaför": ["Kıvırcık Saçlar İçin Bakım Önerileri", "Saç Boyatmadan Önce Bilmeniz Gerekenler", "Evde Saç Bakımı Rutini", "Saç Dökülmesini Önlemenin Doğal Yolları", "Düğün Saçı Seçerken Dikkat Edilecekler"],
  "restoran": ["Menü Tasarımı Nasıl Olmalı?", "Restoran Hijyen Kuralları Rehberi", "Müşteri Memnuniyetini Artırmanın Yolları", "Yemek Fotoğrafı Çekmenin İpuçları", "Mevsimsel Menü Hazırlama Rehberi"],
  "hukuk": ["Kira Sözleşmesinde Dikkat Edilecekler", "İş Hukuku Temel Bilgiler", "KVKK Uyumluluğu Rehberi", "Miras Hukuku Sık Sorulan Sorular", "Şirket Kuruluş Rehberi"],
  "sağlık": ["Düzenli Check-up Neden Önemli?", "Bağışıklık Sistemini Güçlendirmenin Yolları", "Ofiste Ergonomi Rehberi", "Mevsim Geçişlerinde Sağlık İpuçları", "Uyku Kalitesini Artırmanın 7 Yolu"],
  "eğitim": ["Online Eğitimde Başarının Sırları", "Etkili Ders Çalışma Teknikleri", "Öğrenci Motivasyonunu Artırma Rehberi", "Dijital Okuryazarlık Nedir?", "Sınav Kaygısıyla Başa Çıkma"],
  "gayrimenkul": ["Ev Alırken Dikkat Edilecek 10 Şey", "Kiralık Ev Ararken Yapılan Hatalar", "Emlak Yatırımı Başlangıç Rehberi", "Ev Satışını Hızlandırmanın Yolları", "Tapu İşlemleri Adım Adım"],
  "moda": ["2025'te En Trend Kış Kombini", "Gardırop Düzenleme Rehberi", "Online Alışverişte Beden Seçimi", "Kapsül Gardırop Nasıl Oluşturulur?", "Aksesuar Seçiminde 5 Altın Kural"],
  "oto": ["Araç Bakımında Bilinmesi Gerekenler", "Kışa Hazırlık: Araç Kontrol Listesi", "İkinci El Araç Alırken Dikkat Edilecekler", "Akü Bakımı Nasıl Yapılır?", "Lastik Seçim Rehberi"],
};

export function suggestTopics(siteContext: BlogSiteContext): string[] {
  const topics: string[] = [];

  // Sektöre göre konular
  if (siteContext.industry) {
    const industryLower = siteContext.industry.toLowerCase();
    for (const [key, topicList] of Object.entries(INDUSTRY_TOPICS)) {
      if (industryLower.includes(key)) {
        topics.push(...topicList.slice(0, 3));
        break;
      }
    }
  }

  // Site türüne göre konular
  const siteTypeTopics = TOPIC_MAP[siteContext.siteType] || TOPIC_MAP["corporate"];
  for (const t of siteTypeTopics) {
    if (!topics.includes(t) && topics.length < 6) {
      topics.push(t);
    }
  }

  return topics.slice(0, 6);
}

// ── Recommend Prompt Builder ──

export function buildRecommendPrompt(topic: string, siteContext: BlogSiteContext): string {
  return `Sen bir blog stratejistisin. Aşağıdaki site ve konu bilgisine göre en uygun blog formatını ve uzunluğunu öner.

SİTE BİLGİLERİ:
- Marka: ${siteContext.brandName}
- Site türü: ${siteContext.siteType}
- Sektör: ${siteContext.industry || "bilinmiyor"}
- Blog otorite skoru: ${siteContext.blogAuthorityScore ?? "bilinmiyor"}/100

KONU: "${topic}"

FORMAT SEÇENEKLERİ:
1. problem-solution (Adım Adım Rehber) — Bir sorunu adım adım çözer
2. pillar (Kapsamlı Kılavuz) — Konuyu baştan sona anlatır
3. case-study (Başarı Hikayesi) — Gerçek bir deneyimi paylaşır
4. comparison (Karşılaştırma) — İki seçeneği yan yana koyar
5. checklist (Kontrol Listesi) — Yapılacakları madde madde sıralar
6. faq (Soru-Cevap) — En çok sorulan soruları yanıtlar

KURALLAR:
- Blog otorite skoru düşükse (0-30): kısa format öner (600-1200 kelime), basit yapı
- Blog otorite skoru ortaysa (31-60): orta uzunluk (1200-2000 kelime)
- Blog otorite skoru yüksekse (61+) veya konu genişse: kapsamlı (2000+ kelime)
- Sektöre ve konuya en uygun formatı seç
- Basit Türkçe kullan, teknik terim kullanma
- Tavsiyelerini müşteri bakkal, kuaför, kasap gibi düşün — onlara anlatır gibi yaz

CEVAP FORMATI (sadece JSON, başka bir şey yazma):
{
  "recommendedFormat": "format-key",
  "formatLabel": "Türkçe format adı",
  "reasons": ["sebep 1", "sebep 2", "sebep 3"],
  "recommendedLength": 1500,
  "lengthReason": "neden bu uzunluk"
}`;
}

// ── Blog Generation Prompt Builder ──

const FORMAT_TEMPLATES: Record<BlogContentType, string> = {
  "problem-solution": `ŞABLON: Adım Adım Rehber (Problem-Çözüm)
YAPI:
1. Başlık (H1) — Net, problem çözen
2. Giriş (2-3 cümle) — Acıyı tanımla + "ne kazanacaksın" söyle
3. Hemen Cevap — İlk %20'de ana çözümü ver
4. 3-6 Adım Çözüm — Her adım 1 fikir + mini örnek
5. [DENEYİM] kutusu — En az 1 yerde
6. Özet + CTA — 2-3 cümle + tek aksiyon`,

  pillar: `ŞABLON: Kapsamlı Kılavuz (Pillar)
YAPI:
1. Başlık (H1) — Konuyu kapsayan, net
2. Giriş — Konunun önemi + yazıda ne bulacaksın
3. Özet Kutusu — 3-4 maddelik kısa özet (snippet hedefi)
4. Temel Tanım — Konuyu basitçe açıkla
5. Neden Önemli? — 2-3 sebep
6. 5-8 Alt Başlık Rehber — Her biri detaylı, örnekli
7. Sık Yapılan Hatalar — 3-5 hata
8. Araçlar/Kaynaklar — Öneriler
9. [DENEYİM] kutuları — En az 2 yerde
10. Özet + CTA`,

  "case-study": `ŞABLON: Başarı Hikayesi (Case Study)
YAPI:
1. Başlık (H1) — Sonuç odaklı
2. Giriş — Kim, ne hedefledi
3. Hedef — Neyi başarmak istedi
4. Süreç — Adım adım ne yapıldı
5. Zorluklar — Karşılaşılan sorunlar
6. Sonuç — Rakamlarla sonuç
7. [DENEYİM] kutuları — En az 2 yerde
8. Çıkarılan Dersler + CTA`,

  comparison: `ŞABLON: Karşılaştırma
YAPI:
1. Başlık (H1) — "X mi Y mi?" formatı
2. Giriş — Neden bu karşılaştırma önemli
3. X Özellikleri — Artıları/eksileri
4. Y Özellikleri — Artıları/eksileri
5. Karşılaştırma Tablosu — HTML tablo
6. Hangi Durumda Hangisi? — Senaryo bazlı öneriler
7. [DENEYİM] kutusu — 1 yerde
8. CTA`,

  checklist: `ŞABLON: Kontrol Listesi (Checklist)
YAPI:
1. Başlık (H1) — "X Kontrol Listesi" formatı
2. Giriş — Neden bu listeye ihtiyaç var
3. 7-12 Madde — Her madde kısa açıklamalı
4. Her 3 maddede bir mini örnek veya ipucu
5. [DENEYİM] kutusu — 1 yerde
6. CTA`,

  faq: `ŞABLON: Soru-Cevap (SSS)
YAPI:
1. Başlık (H1) — "X Hakkında Sık Sorulan Sorular"
2. Giriş — 2-3 cümle bağlam
3. 8-12 Soru-Cevap — Her cevap 2-4 cümle, basit dil
4. Her 3 soruda bir detaylı açıklama veya örnek
5. [DENEYİM] kutusu — 1 yerde
6. Özet + CTA`,
};

export function buildBlogPrompt(req: BlogGenerateRequest): string {
  const template = FORMAT_TEMPLATES[req.format];
  const maxTokens = req.targetLength <= 1200 ? 2048 : req.targetLength <= 2000 ? 4096 : 8192;
  const maxImages = req.targetLength <= 1200 ? 2 : req.targetLength <= 2000 ? 3 : 5;

  return `Sen profesyonel bir blog yazarısın. Aşağıdaki kurallara HARFI HARFINE uy.

═══════════════════════════════════════
SİTE BAĞLAMI
═══════════════════════════════════════
- Marka: ${req.siteContext.brandName}
- Site türü: ${req.siteContext.siteType}
- Sektör: ${req.siteContext.industry || "genel"}
- Dil: ${req.siteContext.primaryLanguage || "Türkçe"}

═══════════════════════════════════════
GÖREV
═══════════════════════════════════════
- Konu: "${req.topic}"
- Format: ${req.format}
- Hedef uzunluk: ~${req.targetLength} kelime
- Maks görsel: ${maxImages} adet

═══════════════════════════════════════
${template}
═══════════════════════════════════════

═══════════════════════════════════════
İÇERİK KURALLARI
═══════════════════════════════════════

BAŞLIK:
- Net, problem çözen, abartısız, tek vaat
- 60 karakterden kısa
- Rakamla desteklenebilir ("5 Yol", "7 Adım")

GİRİŞ (HOOK):
- İlk 2-3 cümle: acıyı tanımla
- Okura "bu yazıda ne kazanacaksın" söyle
- Heyecan yaratma ama merak uyandır

İLK %20 = CEVAP:
- Kritik bilgiyi en başa koy
- Kısa özet + ana çözüm

GÖVDE:
- Her bölümde tek fikir + mini örnek
- 3-6 adım/bölüm
- Kısa paragraflar (2-4 cümle)

KANIT & DENEYİM:
- [DENEYİM] placeholder'ları koy — kullanıcı kendi sözleriyle dolduracak
- Format: [DENEYİM: kısa açıklama — örn. "müşteri hikayesi", "kişisel gözlem", "rakamsal sonuç"]
- En az 1, idealde 2-3 tane

ÖZET + CTA:
- 2-3 cümle özet
- Tek CTA — net aksiyon ("Hemen başlayın", "Randevu alın" gibi)

═══════════════════════════════════════
SEO ZORUNLULUKLARI
═══════════════════════════════════════
- 1 adet H1 (başlık)
- 3-8 adet H2 (ana bölümler)
- Gerekirse H3 (alt bölümler)
- İlk paragrafta konuyu özetle (featured snippet hedefi)
- Internal link önerileri: <!-- INTERNAL-LINK: anchor text | önerilen hedef sayfa açıklaması -->
- Her görsel için alt text

═══════════════════════════════════════
E-E-A-T
═══════════════════════════════════════
- Yazar bilgisi placeholder: <!-- AUTHOR: Yazar adı ve kısa bio buraya -->
- Kaynaklar bölümü (en az 2 kaynak referansı)
- Gerçek örnek veya senaryo (uydurmak yerine genel sektör bilgisi)

═══════════════════════════════════════
AI KOKUSUNU YOK ETME — YASAKLAR
═══════════════════════════════════════
ASLA kullanma:
- "Bu bağlamda", "Özellikle", "Sonuç olarak", "Genel olarak", "Dolayısıyla"
- "...oldukça önemlidir", "...büyük bir rol oynamaktadır", "...dikkate alınmalıdır"
- "Hadi başlayalım!", "İşte size...", "Merak etmeyin!"
- Gereksiz "Önemli Not:" veya "Dikkat:" kutuları
- Her cümlenin aynı uzunlukta olması
- Her paragrafın aynı yapıda olması

ZORUNLU:
- Her 2-3 paragrafta 1 kısa soru sor okura ("Bunu hiç denediniz mi?")
- Cümle uzunlukları karışık — 5 kelimelik + 20 kelimelik yan yana
- En az 1 yerde "eksik bilgi" itirafı ("Bu konuda herkesin farklı deneyimi var ama benim gördüğüm...")
- Konuşma dili kullan — "yapmak lazım" > "yapılmalıdır"
- İlk kişi tekil kullan ("Ben", "Bence")
- Basit Türkçe, teknik terim varsa parantez içinde açıkla

═══════════════════════════════════════
GÖRSEL PLACEHOLDER'LARI
═══════════════════════════════════════
Görselin gelmesi gereken her yere şu formatı koy (${maxImages} adet):
<!-- IMAGE: kısa görsel açıklaması | TON: ciddi/samimi/pratik/eğlenceli -->

Ton seçimi:
- Ciddi: kurumsal, finans, hukuk konuları
- Samimi: kuaför, kafe, lokal işletme konuları
- Pratik: rehber, nasıl yapılır konuları
- Eğlenceli: lifestyle, trend, liste konuları

═══════════════════════════════════════
ÇIKTI FORMATI
═══════════════════════════════════════
Sadece temiz HTML döndür. Başka bir şey yazma.
- <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <table> kullan
- CSS veya <style> ekleme
- <html>, <head>, <body> ekleme
- Markdown kullanma, sadece HTML

İlk satır: <!-- TITLE: önerilen sayfa başlığı (60 char max) -->
İkinci satır: <!-- META: önerilen meta description (155 char max) -->
Sonra blog HTML'i başlar.`;
}

// ── Parse Helpers ──

export function parseImagePlaceholders(html: string): ImagePlaceholder[] {
  const regex = /<!-- IMAGE: (.+?) \| TON: (.+?) -->/g;
  const results: ImagePlaceholder[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push({
      description: match[1].trim(),
      tone: match[2].trim(),
    });
  }
  return results;
}

export function parseTitleAndMeta(html: string): { title: string; metaDesc: string } {
  const titleMatch = html.match(/<!-- TITLE: (.+?) -->/);
  const metaMatch = html.match(/<!-- META: (.+?) -->/);
  return {
    title: titleMatch?.[1]?.trim() || "",
    metaDesc: metaMatch?.[1]?.trim() || "",
  };
}

// ── Humanize HTML (Post-Processing) ──

const AI_CLICHE_PATTERNS = [
  /Bu bağlamda,?\s*/g,
  /Özellikle,?\s*/g,
  /Sonuç olarak,?\s*/g,
  /Genel olarak,?\s*/g,
  /Dolayısıyla,?\s*/g,
  /oldukça önemlidir/g,
  /büyük bir rol oynamaktadır/g,
  /dikkate alınmalıdır/g,
  /Hadi başlayalım!/g,
  /İşte size/g,
  /Merak etmeyin!/g,
];

export function humanizeHtml(html: string): string {
  let result = html;

  // 1. AI klişe kalıplarını temizle
  for (const pattern of AI_CLICHE_PATTERNS) {
    result = result.replace(pattern, "");
  }

  // 2. Çift boşlukları temizle
  result = result.replace(/  +/g, " ");

  // 3. [DENEYİM] placeholder'larını belirgin kutucuklara çevir
  result = result.replace(
    /\[DENEYİM(?::?\s*(.+?))?\]/g,
    (_match, desc) => {
      const hint = desc
        ? desc.trim()
        : "Burada kendi deneyiminizi, müşteri hikayenizi veya gözleminizi yazın.";
      return `<div class="experience-box" style="background:#f0fdf4; border-left:4px solid #22c55e; padding:16px; margin:16px 0; border-radius:8px;"><strong>&#9997;&#65039; Kendi deneyiminizi ekleyin:</strong><p style="color:#666; font-style:italic;">${hint} Gerçek deneyimler yazınıza güvenilirlik katar.</p></div>`;
    }
  );

  // 4. Boş paragrafları temizle
  result = result.replace(/<p>\s*<\/p>/g, "");

  return result;
}

// ── Imagen Prompt Builder ──

const TONE_STYLES: Record<string, string> = {
  ciddi: "Profesyonel, temiz, minimal, stok fotoğraf tarzı. Düzenli masa, grafik, kurumsal ortam.",
  samimi: "Sıcak, doğal, yakın çekim, insani. Sıcak ışık, doğal ortam.",
  pratik: "Adım adım illüstrasyon, diyagram, infografik tarzı. Temiz, anlaşılır.",
  "eğlenceli": "Renkli, dinamik, modern grafik tarzı. Parlak renkler, grafik öğeler.",
};

export function buildImagePrompt(
  description: string,
  tone: string,
  industry: string | null
): string {
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES["pratik"];
  const industryHint = industry ? ` ${industry} sektörü ile ilgili.` : "";
  return `Blog görseli: ${description}. Stil: ${toneStyle}${industryHint} Profesyonel blog görseli, metin veya yazı içermez, temiz ve modern.`;
}

// ── Gemini API Helpers ──

export async function callGemini(
  prompt: string,
  apiKey: string,
  opts: { temperature?: number; maxOutputTokens?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  const { temperature = 0.7, maxOutputTokens = 4096, timeoutMs = 30000 } = opts;

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    console.error("Gemini API error:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

export async function callImagen(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const res = await fetch(`${IMAGEN_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          personGeneration: "DONT_ALLOW",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error("Imagen API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data?.predictions?.[0]?.bytesBase64Encoded || null;
  } catch (err) {
    console.error("Imagen error:", err);
    return null;
  }
}

// ── Blog Scoring (Client-Side) ──

export function scoreBlog(html: string): BlogScore {
  const criteria: BlogScoreCriterion[] = [];

  // Helper
  const lower = html.toLowerCase();
  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = textContent.split(/\s+/).length;

  // 1. Başlık kalitesi (10)
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const h1Text = h1Match?.[1]?.replace(/<[^>]+>/g, "") || "";
  const h1Score = h1Text.length > 0 && h1Text.length <= 60 ? 10 : h1Text.length > 60 ? 5 : 0;
  criteria.push({
    label: "Başlık kalitesi",
    maxScore: 10,
    score: h1Score,
    passed: h1Score >= 7,
    detail: h1Text.length === 0 ? "H1 başlık bulunamadı" : h1Text.length > 60 ? `Başlık çok uzun (${h1Text.length} karakter)` : "Başlık uygun uzunlukta",
  });

  // 2. Giriş hook (10)
  const firstParas = html.match(/<p[^>]*>(.*?)<\/p>/gi)?.slice(0, 2)?.join(" ") || "";
  const hasQuestion = /\?/.test(firstParas);
  const hookScore = firstParas.length > 50 ? (hasQuestion ? 10 : 7) : 3;
  criteria.push({
    label: "Giriş hook",
    maxScore: 10,
    score: hookScore,
    passed: hookScore >= 7,
    detail: hookScore >= 7 ? "Giriş dikkat çekici" : "Giriş bölümü güçlendirilebilir",
  });

  // 3. İlk %20 cevap (10)
  const twentyPct = Math.floor(textContent.length * 0.2);
  const firstTwenty = textContent.slice(0, twentyPct);
  const hasEarlySolution = /nasıl|adım|çözüm|yöntem|ipucu|öneri/i.test(firstTwenty);
  const earlyScore = hasEarlySolution ? 10 : 5;
  criteria.push({
    label: "İlk %20 cevap",
    maxScore: 10,
    score: earlyScore,
    passed: earlyScore >= 7,
    detail: hasEarlySolution ? "Kritik bilgi yazının başında" : "Ana bilgi daha erken verilebilir",
  });

  // 4. Gövde yapısı (15)
  const h2Count = (html.match(/<h2/gi) || []).length;
  const h3Count = (html.match(/<h3/gi) || []).length;
  const listCount = (html.match(/<[uo]l/gi) || []).length;
  let bodyScore = 0;
  if (h2Count >= 3) bodyScore += 6;
  else if (h2Count >= 1) bodyScore += 3;
  if (h3Count >= 1) bodyScore += 3;
  if (listCount >= 1) bodyScore += 3;
  if (wordCount >= 600) bodyScore += 3;
  bodyScore = Math.min(bodyScore, 15);
  criteria.push({
    label: "Gövde yapısı",
    maxScore: 15,
    score: bodyScore,
    passed: bodyScore >= 10,
    detail: `${h2Count} H2, ${h3Count} H3, ${listCount} liste, ${wordCount} kelime`,
  });

  // 5. Kanıt/deneyim (10)
  const expBoxCount = (html.match(/experience-box/gi) || []).length;
  const expScore = expBoxCount >= 2 ? 10 : expBoxCount >= 1 ? 7 : 0;
  criteria.push({
    label: "Kanıt/deneyim",
    maxScore: 10,
    score: expScore,
    passed: expScore >= 7,
    detail: expBoxCount > 0 ? `${expBoxCount} deneyim kutusu mevcut` : "Deneyim kutusu bulunamadı",
  });

  // 6. CTA (5)
  const hasCta = /randevu|iletişim|başla|dene|ara|tıkla|sipariş|satın|kayıt|abone/i.test(lower);
  const ctaScore = hasCta ? 5 : 0;
  criteria.push({
    label: "CTA",
    maxScore: 5,
    score: ctaScore,
    passed: ctaScore >= 5,
    detail: hasCta ? "CTA tespit edildi" : "Net bir CTA (çağrı) bulunamadı",
  });

  // 7. Okunabilirlik (10)
  const paraCount = (html.match(/<p/gi) || []).length;
  const avgWords = paraCount > 0 ? wordCount / paraCount : wordCount;
  const questionCount = (textContent.match(/\?/g) || []).length;
  let readScore = 0;
  if (avgWords <= 60) readScore += 4;
  else if (avgWords <= 80) readScore += 2;
  if (questionCount >= 2) readScore += 3;
  else if (questionCount >= 1) readScore += 1;
  if (paraCount >= 5) readScore += 3;
  else if (paraCount >= 3) readScore += 1;
  readScore = Math.min(readScore, 10);
  criteria.push({
    label: "Okunabilirlik",
    maxScore: 10,
    score: readScore,
    passed: readScore >= 7,
    detail: `${paraCount} paragraf, ortalama ${Math.round(avgWords)} kelime/paragraf, ${questionCount} soru`,
  });

  // 8. SEO teknik (15)
  const hasH1 = h1Match !== null;
  const titleComment = html.match(/<!-- TITLE: .+? -->/);
  const metaComment = html.match(/<!-- META: .+? -->/);
  const imgAlt = (html.match(/alt="[^"]+"/gi) || []).length;
  const imgTotal = (html.match(/<img/gi) || []).length;
  let seoScore = 0;
  if (hasH1) seoScore += 3;
  if (h2Count >= 2) seoScore += 3;
  if (titleComment) seoScore += 3;
  if (metaComment) seoScore += 3;
  if (imgTotal === 0 || imgAlt >= imgTotal) seoScore += 3;
  seoScore = Math.min(seoScore, 15);
  criteria.push({
    label: "SEO teknik",
    maxScore: 15,
    score: seoScore,
    passed: seoScore >= 10,
    detail: `H1: ${hasH1 ? "var" : "yok"}, H2: ${h2Count}, Title/Meta: ${titleComment ? "var" : "yok"}/${metaComment ? "var" : "yok"}`,
  });

  // 9. E-E-A-T (10)
  const hasAuthorComment = /<!-- AUTHOR:/.test(html);
  const hasSourceSection = /kaynak|referans|source/i.test(lower);
  let eeatScore = 0;
  if (hasAuthorComment) eeatScore += 4;
  if (hasSourceSection) eeatScore += 3;
  if (expBoxCount >= 1) eeatScore += 3;
  eeatScore = Math.min(eeatScore, 10);
  criteria.push({
    label: "E-E-A-T",
    maxScore: 10,
    score: eeatScore,
    passed: eeatScore >= 7,
    detail: `Yazar: ${hasAuthorComment ? "var" : "yok"}, Kaynak: ${hasSourceSection ? "var" : "yok"}, Deneyim: ${expBoxCount > 0 ? "var" : "yok"}`,
  });

  // 10. Görsel (5)
  const imagePlaceholders = (html.match(/<!-- IMAGE:/g) || []).length;
  const embeddedImages = (html.match(/<img/gi) || []).length;
  const totalImages = imagePlaceholders + embeddedImages;
  const imgScore = totalImages >= 2 ? 5 : totalImages >= 1 ? 3 : 0;
  criteria.push({
    label: "Görsel",
    maxScore: 5,
    score: imgScore,
    passed: imgScore >= 3,
    detail: totalImages > 0 ? `${totalImages} görsel/placeholder mevcut` : "Görsel bulunamadı",
  });

  // Toplam
  const total = criteria.reduce((sum, c) => sum + c.score, 0);
  const level: BlogScore["level"] = total >= 80 ? "green" : total >= 60 ? "yellow" : "red";
  const levelLabel = total >= 80 ? "Yayına hazır!" : total >= 60 ? "Neredeyse hazır" : "Biraz daha çalışma gerekiyor";
  const levelMessage =
    total >= 80
      ? "Bu yazıyı sitenize ekleyebilirsiniz. Deneyim kutularını doldurmayı unutmayın."
      : total >= 60
        ? "Birkaç iyileştirme yaparsanız çok daha iyi olur."
        : "Bu yazıyı yayınlamadan önce eksikleri tamamlayın.";

  return { total, level, levelLabel, levelMessage, criteria };
}
