// ── Blog Generator — Prompt Builder + Imagen Helper + Scoring ──

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

export interface BlogGenerateRequest {
  topic: string;
  format: BlogContentType;
  targetLength: number;
  siteContext: BlogSiteContext;
  language?: string;
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

const KIE_CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_POLL_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";

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

const FORMAT_TEMPLATES: Record<BlogContentType, string> = {
  "problem-solution": `ŞABLON: Problem-Çözüm
YAPI:
1. Başlık (H1) — Net, problem çözen
2. Giriş (2-3 cümle) — Acıyı tanımla + "ne kazanacaksın" söyle
3. Hemen Cevap — İlk %20'de ana çözümü ver
4. 3-6 Adım Çözüm — Her adım 1 fikir + mini örnek
5. [DENEYİM] kutusu — En az 1 yerde
6. Özet + CTA — 2-3 cümle + tek aksiyon`,

  rehber: `ŞABLON: Kapsamlı Kılavuz (Rehber)
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

  "vaka-calismasi": `ŞABLON: Başarı Hikayesi (Vaka Çalışması)
YAPI:
1. Başlık (H1) — Sonuç odaklı
2. Giriş — Kim, ne hedefledi
3. Hedef — Neyi başarmak istedi
4. Süreç — Adım adım ne yapıldı
5. Zorluklar — Karşılaşılan sorunlar
6. Sonuç — Rakamlarla sonuç
7. [DENEYİM] kutuları — En az 2 yerde
8. Çıkarılan Dersler + CTA`,

  karsilastirma: `ŞABLON: Karşılaştırma
YAPI:
1. Başlık (H1) — "X mi Y mi?" formatı
2. Giriş — Neden bu karşılaştırma önemli
3. X Özellikleri — Artıları/eksileri
4. Y Özellikleri — Artıları/eksileri
5. Karşılaştırma Tablosu — HTML tablo
6. Hangi Durumda Hangisi? — Senaryo bazlı öneriler
7. [DENEYİM] kutusu — 1 yerde
8. CTA`,

  "kontrol-listesi": `ŞABLON: Kontrol Listesi
YAPI:
1. Başlık (H1) — "X Kontrol Listesi" formatı
2. Giriş — Neden bu listeye ihtiyaç var
3. 7-12 Madde — Her madde kısa açıklamalı
4. Her 3 maddede bir mini örnek veya ipucu
5. [DENEYİM] kutusu — 1 yerde
6. CTA`,

  sss: `ŞABLON: Soru-Cevap (SSS)
YAPI:
1. Başlık (H1) — "X Hakkında Sık Sorulan Sorular"
2. Giriş — 2-3 cümle bağlam
3. 8-12 Soru-Cevap — Her cevap 2-4 cümle, basit dil
4. Her 3 soruda bir detaylı açıklama veya örnek
5. [DENEYİM] kutusu — 1 yerde
6. Özet + CTA`,

  liste: `ŞABLON: Liste (Sıralama İçeriği)
YAPI:
1. Başlık (H1) — "En İyi X", "X Önerisi" formatı
2. Giriş — Neden bu liste hazırlandı, seçim kriterleri
3. 5-15 Madde — Her madde H2/H3 başlık + 2-4 cümle açıklama
4. Her maddede artı/eksi veya kısa değerlendirme
5. Her 3-4 maddede mini karşılaştırma ipucu
6. [DENEYİM] kutusu — 1-2 yerde
7. Sonuç — Genel değerlendirme + CTA`,

  hikaye: `ŞABLON: Hikaye (Anlatım İçeriği)
YAPI:
1. Başlık (H1) — Merak uyandıran, sonuç ima eden
2. Hook (ilk paragraf) — Okuru içine çeken sahne/durum
3. Bağlam — Kim, ne, neden (arka plan)
4. Dönüm Noktası — Değişimin başladığı an
5. Süreç — Neler yaşandı, hangi adımlar atıldı
6. Sonuç — Somut çıktı, rakam veya duygu
7. Çıkarılan Dersler — Okur için uygulanabilir 2-3 öğreti
8. [DENEYİM] kutuları — En az 2 yerde
9. CTA — Okuru aksiyona yönlendir`,

  "teknik-analiz": `ŞABLON: Teknik Analiz (Uzman İçerik)
YAPI:
1. Başlık (H1) — Teknik, net, anahtar kelime odaklı
2. Yönetici Özeti — 3-4 cümle, ana bulgular (snippet hedefi)
3. Giriş — Problem tanımı, analiz kapsamı
4. Metodoloji — Hangi veri/araçlar kullanıldı (kısa)
5. Bulgular — 3-6 bölüm, her biri veri + yorum
6. Karşılaştırma Tablosu — HTML tablo ile veri sunumu
7. Teknik Detaylar — Kod snippet, formül veya diyagram açıklaması
8. Sonuç & Öneriler — Bulgulara dayalı aksiyon maddeleri
9. [DENEYİM] kutuları — En az 1 yerde (gerçek test/uygulama deneyimi)
10. Kaynaklar + CTA`,
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
- Yazım dili: ${req.language === "en" ? "İngilizce" : req.language === "tr" ? "Türkçe" : req.language || req.siteContext.primaryLanguage || "Türkçe"}${req.siteContext.targetAudience ? `\n- Hedef kitle: ${req.siteContext.targetAudience}` : ""}${req.siteContext.blogTone ? `\n- Blog tonu: ${req.siteContext.blogTone}` : ""}${req.siteContext.valueProposition ? `\n- Değer teklifi: ${req.siteContext.valueProposition}` : ""}${req.siteContext.recommendedCta ? `\n- Önerilen CTA: ${req.siteContext.recommendedCta}` : ""}

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
- ${req.language === "en" ? "Write in simple, conversational English. Explain technical terms in parentheses" : "Basit Türkçe, teknik terim varsa parantez içinde açıkla"}

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

/**
 * Gemini HTML yerine markdown/düz metin döndürürse HTML'e çevirir.
 */
export function ensureHtml(raw: string): string {
  // Zaten HTML tag içeriyorsa dokunma
  if (/<h[1-6][\s>]/i.test(raw) && /<\/p>/i.test(raw)) {
    return raw;
  }

  let html = raw;

  // Code block wrapper'ı temizle
  html = html.replace(/^```html?\s*/i, "").replace(/```\s*$/, "");

  // Zaten HTML olabilir, tekrar kontrol
  if (/<h[1-6][\s>]/i.test(html) && /<\/p>/i.test(html)) {
    return html;
  }

  // Markdown → HTML dönüşümü
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

    // HTML comment (IMAGE, TITLE, META, INTERNAL-LINK, AUTHOR) — olduğu gibi bırak
    if (line.trim().startsWith("<!--")) {
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
  return `Blog görseli: ${description}. Stil: ${toneStyle}${industryHint} Profesyonel blog görseli. TEK bir görsel üret, kolaj/grid/bölünmüş/yan yana görsel yapma. Metin veya yazı içermez, temiz ve modern.`;
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
 * kie.ai Nano Banana Pro (Gemini 3 Pro Image) ile görsel üretir.
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
        model: "nano-banana-pro",
        input: {
          prompt,
          aspect_ratio: "16:9",
          resolution: "1K",
          output_format: "jpg",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!createRes.ok) {
      console.error("Kie.ai create error:", createRes.status, await createRes.text());
      return null;
    }

    const createData = await createRes.json();
    console.log("Kie.ai create response:", JSON.stringify(createData));
    const taskId = createData?.data?.taskId;
    if (!taskId) {
      console.error("Kie.ai: taskId alınamadı", createData);
      return null;
    }

    // 2. Poll — max 90 saniye, 5 saniye aralıkla
    const maxAttempts = 18;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));

      const pollRes = await fetch(`${KIE_POLL_URL}?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${kieApiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!pollRes.ok) {
        console.error("Kie.ai poll error:", pollRes.status);
        continue;
      }

      const pollData = await pollRes.json();
      const state = pollData?.data?.state;
      console.log(`Kie.ai poll #${i + 1}: state=${state}`, pollData?.data?.failMsg || "");

      if (state === "success") {
        const resultJson = pollData.data.resultJson;
        const parsed = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
        const url = parsed?.resultUrls?.[0];
        return url || null;
      }

      if (state === "fail") {
        console.error("Kie.ai task failed:", pollData.data.failMsg);
        return null;
      }
      // waiting, queuing, generating → devam et
    }

    console.error("Kie.ai: Timeout — task tamamlanmadı");
    return null;
  } catch (err) {
    console.error("Kie.ai error:", err);
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
