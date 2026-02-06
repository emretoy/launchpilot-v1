// ── Blog Generator — Prompt Builder + Imagen Helper + Scoring ──

import { FORMAT_TEMPLATES, BLOG_MAIN_PROMPT } from "./blog-templates";

// ── Interfaces ──

export interface BlogSiteContext {
  brandName: string;
  siteType: string;
  industry: string | null;
  primaryLanguage: string | null;
  platform: string | null;
  blogAuthorityScore: number | null;
  // v3 aiAnalysis alanları (optional, geriye uyumlu)
  targetAudience?: string | null;
  blogTone?: string | null;
  blogRole?: string | null;
  priorityTopics?: string[];
  topicsToAvoid?: string[];
  recommendedContentTypes?: string[];
  recommendedCta?: string | null;
  valueProposition?: string | null;
}

export interface BlogRecommendation {
  recommendedFormat: BlogContentType;
  formatLabel: string;
  reasons: string[];
  recommendedLength: number;
  lengthReason: string;
  structure_tip: string;
}

export type BlogContentType =
  | "problem-solution"
  | "rehber"
  | "vaka-calismasi"
  | "karsilastirma"
  | "kontrol-listesi"
  | "sss"
  | "liste"
  | "hikaye"
  | "teknik-analiz";

export const BLOG_FORMAT_OPTIONS: {
  value: BlogContentType;
  label: string;
  description: string;
}[] = [
  { value: "problem-solution", label: "Problem-Çözüm", description: "Bir sorunu adım adım çözer" },
  { value: "rehber", label: "Kapsamlı Kılavuz", description: "Konuyu baştan sona anlatır" },
  { value: "vaka-calismasi", label: "Başarı Hikayesi", description: "Gerçek bir deneyimi paylaşır" },
  { value: "karsilastirma", label: "Karşılaştırma", description: "İki seçeneği yan yana koyar" },
  { value: "kontrol-listesi", label: "Kontrol Listesi", description: "Yapılacakları madde madde sıralar" },
  { value: "sss", label: "Soru-Cevap", description: "En çok sorulan soruları yanıtlar" },
  { value: "liste", label: "Liste", description: "En iyi X, X önerileri gibi sıralama içerikleri" },
  { value: "hikaye", label: "Hikaye", description: "Marka hikayesi, kişisel deneyim, ilham verici anlatım" },
  { value: "teknik-analiz", label: "Teknik Analiz", description: "Derinlemesine teknik içerik, veri odaklı, uzman kitle" },
];

// ── Legacy Format Normalizer (eski DB key → yeni key) ──

const LEGACY_FORMAT_MAP: Record<string, BlogContentType> = {
  pillar: "rehber",
  "case-study": "vaka-calismasi",
  comparison: "karsilastirma",
  checklist: "kontrol-listesi",
  faq: "sss",
};

export function normalizeLegacyFormat(fmt: string | null | undefined): string {
  if (!fmt) return "problem-solution";
  return LEGACY_FORMAT_MAP[fmt] || fmt;
}

export interface TopicDataForPrompt {
  title: string;
  funnel_stage?: string;
  target_persona?: string;
  suggested_cta?: string;
  keywords?: string[];
  search_intent?: string;
  difficulty?: string;
  content_type?: string;
}

export interface FormatRecommendationForPrompt {
  recommendedFormat: string;
  recommendedLength: number;
  structure_tip?: string;
}

export interface DNAAnalysisForPrompt {
  tone_and_voice?: {
    recommended_blog_tone?: string;
    brand_voice_keywords?: string[];
  };
  target_audience?: {
    primary_audience?: string;
    awareness_level?: string;
  };
  business_identity?: {
    value_proposition?: string;
    industry?: string;
    brand_name?: string;
  };
  cta_structure?: {
    recommended_blog_cta?: string;
  };
  revenue_model?: {
    primary_conversion_action?: string;
  };
  content_language?: string;
}

export interface BlogGenerateRequest {
  topic: string;
  format: BlogContentType;
  targetLength: number;
  siteContext: BlogSiteContext;
  language?: string;
  topicData?: TopicDataForPrompt;
  formatRecommendation?: FormatRecommendationForPrompt;
  dnaAnalysis?: DNAAnalysisForPrompt;
}

export interface BlogGenerateResult {
  blogHtml: string;
  imageDescriptions: ImagePlaceholder[];
  seoChecklist: string[];
  suggestedTitle: string;
  suggestedMetaDesc: string;
  suggestedAuthor: string;
  chosenFormat: string;
  error: string | null;
}

export interface ImagePlaceholder {
  description: string;
  tone: string;
  type?: "cover" | "inline";
  altText?: string;
  overlayText?: string;
  mood?: string;
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

// Kie.ai GPT-4o Image API (eski: Grok Imagine)
const KIE_CREATE_URL = "https://api.kie.ai/api/v1/gpt4o-image/generate";
const KIE_POLL_URL = "https://api.kie.ai/api/v1/gpt4o-image/record-info";

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

export function buildRecommendPrompt(topic: string, siteContext: BlogSiteContext, topicData?: Record<string, unknown>): string {
  const dnaAnalysisJSON = JSON.stringify({
    brand: siteContext.brandName,
    site_type: siteContext.siteType,
    industry: siteContext.industry || "genel",
    blog_authority_score: siteContext.blogAuthorityScore,
    target_audience: siteContext.targetAudience || null,
    blog_tone: siteContext.blogTone || null,
    blog_role: siteContext.blogRole || null,
    value_proposition: siteContext.valueProposition || null,
    recommended_cta: siteContext.recommendedCta || null,
  }, null, 2);

  const topicJSON = JSON.stringify(topicData || { title: topic }, null, 2);

  return `Sen bir blog format ve uzunluk uzmanısın.
Verilen TEK bir konu için EN UYGUN format ve kelime sayısını belirle.

═══════════════════════════════════════
SİTE DNA ANALİZİ (ÖZET)
═══════════════════════════════════════
${dnaAnalysisJSON}

DNA'yı şu kararlar için kullan:
- target_audience → B2B ise teknik/profesyonel formatlar
  (vaka-calismasi, teknik-analiz) ağırlıklı olabilir.
  B2C ise erişilebilir formatlar (liste, rehber, hikaye) ağırlıklı.
- blog_tone → format tonu bununla uyumlu olmalı
- awareness_level → Unaware kitle için kısa/basit formatlar,
  Product-Aware kitle için detaylı/karşılaştırmalı formatlar

═══════════════════════════════════════
KONU
═══════════════════════════════════════
${topicJSON}

Konuda şu alanlar zaten var — bunları KULLAN:
- title → konunun başlığı
- funnel_stage → TOFU/MOFU/BOFU
- search_intent → informational/commercial/navigational/transactional
- suggestedFormat → önceki adımın kaba format tahmini (referans al ama
  körü körüne kopyalama, kendi analizini yap)
- difficulty → Kolay/Orta/Zor
- content_type → pillar/standalone
- target_persona → kime yazılıyor

═══════════════════════════════════════
FORMAT SEÇENEKLERİ (9 ADET)
═══════════════════════════════════════

1. problem-solution
   Label: Problem-Çözüm
   Ne zaman: "Nasıl yapılır?" sorusu, bir sorunu çözen konular
   Örnek: "WordPress hızlandırma", "Küçük odayı geniş gösterme"
   Tipik uzunluk: 800-1500 kelime

2. rehber
   Label: Kapsamlı Kılavuz
   Ne zaman: Geniş, kapsamlı, ansiklopedik konular. A'dan Z'ye anlatım.
   Örnek: "Dijital pazarlama rehberi", "Ev dekorasyonu başlangıç rehberi"
   Tipik uzunluk: 1500-2500 kelime
   ⚠️ SADECE gerçekten geniş konularda kullan. Dar konularda KULLANMA.

3. vaka-calismasi
   Label: Başarı Hikayesi
   Ne zaman: Deneyim, sonuç paylaşımı, müşteri başarı hikayesi
   Örnek: "X firması ile satışları %200 artırdık"
   Tipik uzunluk: 1000-2000 kelime

4. karsilastirma
   Label: Karşılaştırma
   Ne zaman: İki veya daha fazla şey kıyaslanıyorsa, "hangisi daha iyi"
   Örnek: "WordPress vs Wix", "Masif ahşap vs MDF"
   Tipik uzunluk: 1200-2000 kelime

5. kontrol-listesi
   Label: Kontrol Listesi
   Ne zaman: Adım adım kontrol edilebilecek konular
   Örnek: "SEO kontrol listesi", "Ev taşıma rehberi"
   Tipik uzunluk: 600-1200 kelime

6. sss
   Label: Soru-Cevap
   Ne zaman: Sıkça sorulan sorular, bilgilendirici kısa yanıtlar
   Örnek: "E-ticaret hakkında merak edilenler"
   Tipik uzunluk: 600-1200 kelime

7. liste
   Label: Liste
   Ne zaman: "En iyi X", "X önerileri", sıralama/kürasyon içerikleri
   Örnek: "2025'in en iyi 10 çalışma masası", "Küçük evler için 7 mobilya"
   Tipik uzunluk: 800-1500 kelime

8. hikaye
   Label: Hikaye
   Ne zaman: Marka hikayesi, kişisel deneyim, ilham verici anlatım
   Örnek: "Evimi nasıl dönüştürdüm", "Müşterimizin dekorasyon yolculuğu"
   Tipik uzunluk: 800-1500 kelime

9. teknik-analiz
   Label: Teknik Analiz
   Ne zaman: Derinlemesine teknik içerik, veri odaklı, uzman kitle
   Örnek: "MDF vs sunta: malzeme mukavemet karşılaştırması"
   Tipik uzunluk: 1500-2500 kelime

═══════════════════════════════════════
FORMAT SEÇME KURALLARI
═══════════════════════════════════════

⚠️ ÖNEMLİ: Her konuya "rehber" (Kapsamlı Kılavuz) seçersen YANLIŞ
yapmış olursun. Konunun doğasına bak. 9 farklı format var — hepsini
kullan. "Rehber" SADECE gerçekten geniş, ansiklopedik konular içindir.

Başlık Sinyalleri:
  - "Nasıl" ile başlayan → genellikle problem-solution
  - "En iyi", "X önerileri", "X tavsiyeleri" → genellikle liste
  - "X vs Y", "hangisi" → genellikle karsilastirma
  - "X nedir", "X rehberi" (geniş konu) → genellikle rehber
  - "X nedir" (dar konu) → problem-solution veya sss
  - "X kontrol listesi" → kontrol-listesi
  - "X hakkında SSS", "sıkça sorulan" → sss
  - Teknik terim yoğun, veri odaklı → teknik-analiz
  - "Hikayemiz", "nasıl başladık", "yolculuk" → hikaye

Pillar vs Standalone:
  - content_type: "pillar" → genellikle rehber, ama HER pillar
    rehber OLMAK ZORUNDA DEĞİL. Pillar başlığı karşılaştırma
    sinyali taşıyorsa (X vs Y) → karsilastirma, liste sinyali
    taşıyorsa (En iyi X) → liste formatı seçilebilir.
  - Pillar içeriklerde structure_tip ZORUNLU (max 20 kelime).
    Şu unsurları öner: içindekiler tablosu, minimum 5 alt başlık,
    cluster yazılara link yapısı.
  - Standalone → daha kısa ve odaklı formatlar.
    structure_tip opsiyonel — sadece yapısal bir tavsiye varsa yaz,
    yoksa boş string "" bırak.

Dar vs Geniş Konu Tanımı:
  - Dar konu: Tek ana soru, 1-2 alt soru ile cevaplanabilir.
    Örn: "Ahşap masa nasıl temizlenir" → problem-solution
  - Geniş konu: 5+ alt başlık gerektirir, birden fazla boyutu var.
    Örn: "Ev dekorasyonu başlangıç rehberi" → rehber
  - Geniş görünen ama aslında dar konulara DİKKAT:
    "Small Space Furniture Solutions" → geniş gibi ama tek problem
    (alan darlığı) var → problem-solution, rehber DEĞİL.

Funnel Eğilimleri (kural değil, eğilim):
  - TOFU → problem-solution, rehber, liste, sss, hikaye
  - MOFU → karsilastirma, liste, kontrol-listesi, teknik-analiz
  - BOFU → vaka-calismasi, karsilastirma, kontrol-listesi

Intent Bazlı Eğilimler:
  - informational → problem-solution, rehber, sss
  - commercial → karsilastirma, liste, teknik-analiz
  - transactional → kontrol-listesi, vaka-calismasi, karsilastirma
  - navigational → sss veya problem-solution, uzunluk 600-900.
    Navigational intent blog için nadirdir — kısa ve odaklı tut.

Uzunluk Kararı:
  - difficulty: Kolay → formatın alt sınırına yakın
  - difficulty: Orta → formatın orta noktası
  - difficulty: Zor → formatın üst sınırına yakın
  - Dar konu → kısa. Geniş konu → uzun.
  - recommendedLength her zaman integer olmalı.
  - Intent-Uzunluk Dengesi (KRİTİK): Eğer search_intent
    "transactional" veya "commercial" ise, kelime sayısını zorluk
    seviyesine rağmen %10-20 daha kompakt tut. Ticari niyetli
    okuyucu hızlı karar vermek ister — uzun içerik dönüşümü düşürür.
    Örn: difficulty Zor + intent commercial → 2500 yerine 2000 civarı.

═══════════════════════════════════════
ÇIKTI FORMATI
═══════════════════════════════════════
Sadece JSON döndür, başka bir şey yazma:

{
  "topic_title": "Orijinal konu başlığı — değiştirme",
  "recommendedFormat": "problem-solution | rehber | vaka-calismasi | karsilastirma | kontrol-listesi | sss | liste | hikaye | teknik-analiz",
  "formatLabel": "Türkçe format adı (Label alanından al)",
  "reasons": ["sebep 1", "sebep 2", "sebep 3"],
  "recommendedLength": 1200,
  "lengthReason": "Neden bu uzunluk — max 1 cümle",
  "structure_tip": "Yapısal tavsiye — max 1 cümle. Pillar içeriklerde zorunlu, standalone'da opsiyonel."
}

═══════════════════════════════════════
JSON VERİ TİPLERİ
═══════════════════════════════════════
- Tüm string alanları her zaman string döndür, asla null yapma.
- recommendedFormat SADECE şu 9 ASCII key'den biri olabilir:
  problem-solution, rehber, vaka-calismasi, karsilastirma,
  kontrol-listesi, sss, liste, hikaye, teknik-analiz
  Türkçe karakter KULLANMA (karşılaştırma ❌ → karsilastirma ✅).
- reasons dizisi: her zaman TAM 3 eleman, asla boş dizi olmasın.
  Her reason şu 3 perspektiften birini kapsasın:
  1. Başlık sinyali + format eşleşmesi
  2. Funnel stage + search intent uyumu
  3. Persona/tone + derinlik uyumu
  Zayıf nedenler yazma ("uygun", "güzel", "TOFU" gibi tek kelime).
  Her reason en az 1 cümle olmalı.
- recommendedLength: integer (string değil). Asla null yapma.
  Seçilen formatın tipik aralığında kalmalı. Intent compact kuralı
  uygulanınca bile formatın alt sınırının altına düşmemeli.
  Örn: problem-solution (800-1500) + compact → minimum 800.
- structure_tip: pillar konularda dolu string, standalone'da boş string ""
  olabilir. Asla null yapma. Max 20 kelime.

Eksik Veri Kuralı:
- TOPIC_JSON'da target_persona veya başka bir alan eksikse,
  "veri mevcut değil" varsayımıyla karar ver. Eksik alanı UYDURMA,
  mevcut alanlarla (title, funnel_stage, intent) karar ver.`;
}

// ── Blog Generation Prompt Builder ──

function buildFallbackDnaJson(ctx: BlogSiteContext): string {
  return JSON.stringify({
    tone_and_voice: {
      recommended_blog_tone: ctx.blogTone || "samimi ve bilgilendirici",
      brand_voice_keywords: [],
    },
    target_audience: {
      primary_audience: ctx.targetAudience || null,
      awareness_level: null,
    },
    business_identity: {
      value_proposition: ctx.valueProposition || null,
      industry: ctx.industry || "genel",
      brand_name: ctx.brandName,
    },
    cta_structure: {
      recommended_blog_cta: ctx.recommendedCta || null,
    },
    revenue_model: {
      primary_conversion_action: null,
    },
    content_language: ctx.primaryLanguage || "tr",
  }, null, 2);
}

export function buildBlogPrompt(req: BlogGenerateRequest): string {
  // 1. DNA_ANALYSIS_JSON — content_language her zaman mevcut olmalı
  let dnaJson: string;
  if (req.dnaAnalysis) {
    const dna = { ...req.dnaAnalysis };
    // req.language (topic scan ayarı) her zaman DNA'dan öncelikli
    dna.content_language = req.language || dna.content_language || req.siteContext.primaryLanguage || "tr";
    dnaJson = JSON.stringify(dna, null, 2);
  } else {
    dnaJson = buildFallbackDnaJson(req.siteContext);
  }

  // 2. TOPIC_JSON
  const topicJson = req.topicData
    ? JSON.stringify(req.topicData, null, 2)
    : JSON.stringify({ title: req.topic }, null, 2);

  // 3. FORMAT_JSON
  const formatJson = req.formatRecommendation
    ? JSON.stringify(req.formatRecommendation, null, 2)
    : JSON.stringify({
        recommendedFormat: req.format,
        recommendedLength: req.targetLength,
        structure_tip: "",
      }, null, 2);

  // 4. FORMAT_TEMPLATE
  const formatTemplate = FORMAT_TEMPLATES[req.format];

  // Prompt: v2.4 ana prompt, 4 değişken inject
  return BLOG_MAIN_PROMPT
    .replace("{{DNA_ANALYSIS_JSON}}", dnaJson)
    .replace("{{TOPIC_JSON}}", topicJson)
    .replace("{{FORMAT_JSON}}", formatJson)
    .replace("{{FORMAT_TEMPLATE}}", formatTemplate);
}

// ── Parse Helpers ──

export function parseImagePlaceholders(html: string): ImagePlaceholder[] {
  const results: ImagePlaceholder[] = [];

  // TİP 1: COVER-IMAGE: sahne | TEXT: metin | MOOD: atmosfer
  const coverRegex = /<!-- COVER-IMAGE: (.+?) \| TEXT: (.+?) \| MOOD: (.+?) -->/g;
  let match;
  while ((match = coverRegex.exec(html)) !== null) {
    results.push({
      description: match[1].trim(),
      tone: "pratik",
      type: "cover",
      overlayText: match[2].trim(),
      mood: match[3].trim(),
    });
  }

  // TİP 2: IMAGE: sahne | ALT: alt text | TON: ton (v2.4)
  const inlineRegex = /<!-- IMAGE: (.+?) \| ALT: (.+?) \| TON: (.+?) -->/g;
  while ((match = inlineRegex.exec(html)) !== null) {
    results.push({
      description: match[1].trim(),
      tone: match[3].trim(),
      type: "inline",
      altText: match[2].trim(),
    });
  }

  // Eski fallback: IMAGE: sahne | TON: ton (zaten yakalanmamışları ekle)
  const legacyRegex = /<!-- IMAGE: (.+?) \| TON: (.+?) -->/g;
  while ((match = legacyRegex.exec(html)) !== null) {
    const desc = match[1].trim();
    // Zaten v2.4 regex ile yakalandıysa ekleme
    if (!results.some((r) => r.description === desc)) {
      results.push({
        description: desc,
        tone: match[2].trim(),
        type: "inline",
      });
    }
  }

  // Gemini COVER-IMAGE formatını kullanmamışsa ilk görseli cover'a promote et
  if (results.length > 0 && !results.some((r) => r.type === "cover")) {
    results[0] = { ...results[0], type: "cover" };
  }

  return results;
}

export function parseTitleAndMeta(html: string): { title: string; metaDesc: string; author: string } {
  const titleMatch = html.match(/<!-- TITLE: (.+?) -->/);
  const metaMatch = html.match(/<!-- META: (.+?) -->/);
  const authorMatch = html.match(/<!-- AUTHOR: (.+?) -->/);
  return {
    title: titleMatch?.[1]?.trim() || "",
    metaDesc: metaMatch?.[1]?.trim() || "",
    author: authorMatch?.[1]?.trim() || "",
  };
}

// ── Cover Image Position Fix (Post-Processing) ──

/**
 * COVER-IMAGE (veya yoksa ilk IMAGE) comment'ini H1'den hemen sonraya taşır.
 * Gemini bazen cover görseli giriş paragraflarından sonra koyuyor — bu fonksiyon düzeltir.
 */
export function ensureCoverImagePosition(html: string): string {
  // COVER-IMAGE veya yoksa ilk IMAGE comment'ini bul
  const coverMatch = html.match(/<!-- COVER-IMAGE:.*?-->/);
  const targetComment = coverMatch ? coverMatch[0] : html.match(/<!-- IMAGE:.*?-->/)?.[0];

  if (!targetComment) return html;

  // H1 kapanış tag'ini bul
  const h1CloseMatch = html.match(/<\/h1>/i);
  if (!h1CloseMatch) return html;

  const h1CloseIdx = html.indexOf(h1CloseMatch[0]);
  const commentIdx = html.indexOf(targetComment);

  // Zaten H1'den hemen sonra mı? (aralarında sadece whitespace varsa dokunma)
  if (commentIdx > h1CloseIdx) {
    const between = html.slice(h1CloseIdx + h1CloseMatch[0].length, commentIdx).trim();
    if (between === "") return html;
  }

  // Mevcut yerinden kaldır
  const withoutComment = html.replace(targetComment, "");

  // H1'den sonraya ekle
  const newH1Idx = withoutComment.indexOf(h1CloseMatch[0]);
  const insertPos = newH1Idx + h1CloseMatch[0].length;

  return withoutComment.slice(0, insertPos) + "\n" + targetComment + withoutComment.slice(insertPos);
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

/**
 * Gemini HTML yerine markdown/düz metin döndürürse HTML'e çevirir.
 */
export function ensureHtml(raw: string): string {
  let html = raw;

  // Code block wrapper'ı temizle (```html ... ```)
  html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/, "");

  // HTML yoğunluk testi: yeterince HTML tag varsa dokunma
  const hTags = (html.match(/<h[1-6][\s>]/gi) || []).length;
  const pTags = (html.match(/<\/p>/gi) || []).length;
  const mdHeadings = (html.match(/^#{1,6}\s+/gm) || []).length;
  const mdBold = (html.match(/\*\*.+?\*\*/g) || []).length;

  // Eğer HTML tag sayısı yeterliyse VE markdown heading yoksa → zaten HTML
  if (hTags >= 3 && pTags >= 3 && mdHeadings === 0) {
    return html;
  }

  // Markdown veya mixed content → tamamen dönüştür
  const lines = html.split("\n");
  const result: string[] = [];
  let inList: "ul" | "ol" | null = null;

  function closeList() {
    if (inList) {
      result.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trimEnd();

    // Boş satır
    if (!line.trim()) {
      closeList();
      continue;
    }

    // Zaten HTML tag olan satır (h1, h2, p, ul, ol, table, blockquote, div, img) — olduğu gibi bırak
    if (/^\s*<(h[1-6]|p|ul|ol|li|table|thead|tbody|tr|th|td|blockquote|div|img|figure|section)\b/i.test(line.trim())) {
      closeList();
      result.push(line);
      continue;
    }

    // HTML comment (IMAGE, TITLE, META, INTERNAL-LINK, AUTHOR) — olduğu gibi bırak
    if (line.trim().startsWith("<!--")) {
      closeList();
      result.push(line);
      continue;
    }

    // Headings: # → h1, ## → h2, ### → h3
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      result.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Numbered heading: "1. Bold Title" at start (section headers)
    const numberedHeading = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s*$/);
    if (numberedHeading) {
      closeList();
      result.push(`<h2>${numberedHeading[1]}. ${numberedHeading[2]}</h2>`);
      continue;
    }

    // Unordered list: - item or * item
    const ulMatch = line.match(/^[\-\*]\s+(.+)$/);
    if (ulMatch) {
      if (inList !== "ul") {
        closeList();
        result.push("<ul>");
        inList = "ul";
      }
      result.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list: 1. item (not a heading)
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch && !line.match(/^(\d+)\.\s+\*\*.+\*\*\s*$/)) {
      if (inList !== "ol") {
        closeList();
        result.push("<ol>");
        inList = "ol";
      }
      result.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Blockquote: > text
    const bqMatch = line.match(/^>\s*(.+)$/);
    if (bqMatch) {
      closeList();
      result.push(`<blockquote><p>${inlineFormat(bqMatch[1])}</p></blockquote>`);
      continue;
    }

    // Kapanış tag'i olan satır (</ul>, </ol>, </table> vb.) — olduğu gibi bırak
    if (/^\s*<\//.test(line.trim())) {
      closeList();
      result.push(line);
      continue;
    }

    // Normal paragraf
    closeList();
    result.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeList();
  return result.join("\n");
}

/** Inline markdown: **bold**, *italic*, `code`, [link](url) */
function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

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

// ── Imagen Prompt Builder (v1.2) ──

// Kie.ai (Grok Imagine / xAI) metin render edemiyor
const IMAGE_MODEL_SUPPORTS_TEXT = true;

const TON_STIL_MAP: Record<string, string> = {
  ciddi: "editorial studio photography, neutral tones, hard lighting, high contrast, 35mm lens",
  samimi: "warm cozy photography, soft bokeh, golden hour lighting, 50mm lens, natural feel",
  pratik: "clean product photography, soft even lighting, crisp details, 85mm lens, studio quality",
  "eğlenceli": "vibrant lifestyle photography, dynamic angles, bright natural lighting, wide angle lens",
};

const SECTOR_STYLE_HINTS: Record<string, string> = {
  "mobilya": "interior design staging, clean background",
  "dekorasyon": "interior design staging, clean background",
  "teknoloji": "tech product, gradient background, minimal",
  "saas": "tech product, gradient background, minimal",
  "yemek": "overhead flat lay, natural light, wooden surface",
  "restoran": "overhead flat lay, natural light, wooden surface",
  "sağlık": "clean white space, calming colors, medical",
  "medikal": "clean white space, calming colors, medical",
  "eğitim": "educational, colorful but professional",
  "hizmet": "professional office environment",
  "danışmanlık": "professional office environment",
  "hukuk": "professional office environment",
  "moda": "pastel tones, lifestyle, aesthetic composition",
  "güzellik": "pastel tones, lifestyle, aesthetic composition",
  "kuaför": "pastel tones, lifestyle, aesthetic composition",
  "inşaat": "wide angle, structural detail, blue sky",
  "mimarlık": "wide angle, structural detail, blue sky",
  "gayrimenkul": "wide angle, structural detail, blue sky",
};

function getSectorHint(industry: string | null): string {
  if (!industry) return "";
  const lower = industry.toLowerCase();
  for (const [key, hint] of Object.entries(SECTOR_STYLE_HINTS)) {
    if (lower.includes(key)) return ` ${hint}.`;
  }
  return "";
}

/**
 * v1.2 görsel prompt builder.
 * Hem eski (description, tone, industry) hem yeni (ImagePlaceholder) format destekler.
 * ÖNEMLİ: Grok Imagine Türkçe metni resme basıyor — prompt tamamen İngilizce ve kısa olmalı.
 */
export function buildImagePrompt(
  descriptionOrPlaceholder: string | ImagePlaceholder,
  tone?: string,
  industry?: string | null
): string {
  // Eski format: (description, tone, industry) — geriye uyumlu
  if (typeof descriptionOrPlaceholder === "string") {
    const toneStyle = TON_STIL_MAP[tone || "pratik"] || TON_STIL_MAP["pratik"];
    const sectorHint = getSectorHint(industry ?? null);
    return `${descriptionOrPlaceholder}, ${toneStyle},${sectorHint} photorealistic, single image, 16:9 aspect ratio, professional blog photo, no text, no words, no letters, no collage, no grid, no split image, no people, no faces, no watermarks`;
  }

  // Yeni format: ImagePlaceholder objesi
  const p = descriptionOrPlaceholder;
  const sectorHint = getSectorHint(industry ?? null);

  // COVER-IMAGE — Metin overlay frontend CSS ile yapılacak, görselde metin olmasın
  if (p.type === "cover") {
    const mood = p.mood || "modern";
    return `${p.description}, blog cover photo, ${mood} atmosphere,${sectorHint} with dark cinematic gradient fading from transparent at top to dark at bottom third, photorealistic, single image, 16:9 aspect ratio, high quality, no text, no words, no letters, no people, no faces, no watermarks, no collage`;
  }

  // IMAGE (inline content)
  const toneStyle = TON_STIL_MAP[p.tone] || TON_STIL_MAP["pratik"];
  const altHint = p.altText ? `, concept: ${p.altText}` : "";
  return `${p.description}${altHint}, ${toneStyle},${sectorHint} photorealistic, single image, 16:9 aspect ratio, professional blog photo, no text, no words, no letters, no collage, no grid, no split image, no people, no faces, no watermarks`;
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

/**
 * kie.ai GPT-4o Image API ile görsel üretir.
 * Asenkron: task oluştur → poll → sonuç URL'i döndür.
 */
export async function callImageGen(
  prompt: string,
  kieApiKey: string
): Promise<string | null> {
  try {
    // 1. Task oluştur
    const createRes = await fetch(KIE_CREATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        prompt,
        size: "3:2", // landscape (16:9'a en yakın)
        nVariants: 1,
        isEnhance: false,
        enableFallback: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!createRes.ok) {
      console.error("Kie.ai create error:", createRes.status, await createRes.text());
      return null;
    }

    const createData = await createRes.json();
    console.log("Kie.ai 4o create response:", JSON.stringify(createData));
    const taskId = createData?.data?.taskId;
    if (!taskId) {
      console.error("Kie.ai: taskId alınamadı", createData);
      return null;
    }

    // 2. Poll — max 120 saniye, 10 saniye aralıkla (4o daha yavaş olabilir)
    const maxAttempts = 12;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 10000));

      const pollRes = await fetch(`${KIE_POLL_URL}?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${kieApiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!pollRes.ok) {
        console.error("Kie.ai poll error:", pollRes.status);
        continue;
      }

      const pollData = await pollRes.json();
      const data = pollData?.data;
      const successFlag = data?.successFlag;
      const progress = data?.progress;
      console.log(`Kie.ai 4o poll #${i + 1}: success=${successFlag}, progress=${progress}`, data?.errorMessage || "");

      if (successFlag === 1) {
        const url = data?.response?.resultUrls?.[0];
        return url || null;
      }

      if (data?.errorCode || data?.errorMessage) {
        console.error("Kie.ai 4o task failed:", data.errorMessage);
        return null;
      }
      // Henüz bitmedi → devam et
    }

    console.error("Kie.ai 4o: Timeout — task tamamlanmadı");
    return null;
  } catch (err) {
    console.error("Kie.ai 4o error:", err);
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

// ── BlogTopic → TopicDataForPrompt Helper ──

export function buildTopicDataFromBlogTopic(topic: {
  title: string;
  funnel_stage?: string;
  target_persona?: string;
  suggested_cta?: string;
  keywords?: string[];
  search_intent?: string;
  difficulty?: string;
  content_type?: string;
}): TopicDataForPrompt {
  return {
    title: topic.title,
    funnel_stage: topic.funnel_stage || undefined,
    target_persona: topic.target_persona || undefined,
    suggested_cta: topic.suggested_cta || undefined,
    keywords: topic.keywords || undefined,
    search_intent: topic.search_intent || undefined,
    difficulty: topic.difficulty || undefined,
    content_type: topic.content_type || undefined,
  };
}
