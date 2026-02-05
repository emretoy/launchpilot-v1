# LaunchPilot v1

Site kimlik tarama sistemi. URL giren kullanıcının sitesini analiz edip detaylı rapor çıkarır.

## Tech Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- cheerio (HTML crawling)
- Google PageSpeed Insights API (ücretsiz)

## Proje Yapısı

```
src/
├── app/
│   ├── layout.tsx          # Root layout (TR dil)
│   ├── page.tsx            # Landing: URL input
│   ├── analyze/page.tsx    # Sonuç sayfası (client)
│   └── api/analyze/route.ts # Ana analiz endpoint (POST)
├── lib/
│   ├── types.ts            # Tüm TypeScript tipleri
│   ├── crawler.ts          # cheerio + fetch HTML crawler
│   ├── pagespeed.ts        # PageSpeed Insights API client
│   ├── ssl-checker.ts      # SSL sertifika kontrolü
│   ├── tech-detector.ts    # WordPress/Wix/Shopify tespiti
│   ├── link-checker.ts     # Kırık link kontrolü
│   ├── validator.ts        # Veri doğrulama katmanı (scraper + skor tutarlılık)
│   └── utils.ts            # shadcn/ui utils
└── components/
    ├── ui/                 # shadcn/ui bileşenleri
    ├── url-input.tsx       # URL giriş formu
    └── analysis-result.tsx # Sonuç gösterimi
```

## Komutlar
- `npm run dev` - Geliştirme sunucusu
- `npm run build` - Production build
- `npm run lint` - ESLint

## API Akışı
POST /api/analyze { url: "https://example.com" }
→ Paralel: crawler + PageSpeed + SSL
→ JSON response: AnalysisResult

## Kurallar
- Türkçe UI, İngilizce kod
- Açık tema (dark mode yok)
- API key gerekmez (PageSpeed ücretsiz tier)
- **Veri Doğrulama Zorunluluğu:** Yeni bir veri kaynağı (API, scraper, AI çıktısı) eklendiğinde, `src/lib/validator.ts`'e karşılık gelen doğrulama fonksiyonu da zorunlu olarak eklenir. Doğrulanmamış veri kullanıcıya gösterilmez. Her fonksiyon `ValidationCheckResult` pattern'i kullanır.

---

## SON DURUM (4 Şubat 2026)

### Tamamlanan İşler
- Reddit "Sitalyze" postu analiz edildi (211 upvote, 124 yorum)
- LaunchPilot vs Sitalyze karşılaştırması yapıldı
- SaaS iş modeli tasarlandı (Free/Pro/Business)
- Part 1 planı detaylıca hazırlandı (plan dosyası: .claude/plans/velvet-popping-walrus.md)
- Notion "Launch Pilot Web" sayfasına 5 database oluşturuldu:
  1. Part 1 Sprint Tasks (14 task)
  2. API Entegrasyonları (12 API)
  3. Puanlama Sistemi (8 kategori)
  4. Dosya Değişiklikleri (20 dosya)
  5. Sitalyze Karşılaştırma (28 özellik)

### Sıradaki İş: PART 1 KOD YAZIMI
Henüz hiç kod yazılmadı. Uygulama sırası:

1. `src/lib/types.ts` → 9 yeni interface ekle
2. 6 yeni lib modülü (paralel yazılabilir):
   - `src/lib/domain-info.ts` (RDAP + Web Archive)
   - `src/lib/security-headers.ts` (Mozilla Observatory)
   - `src/lib/safe-browsing.ts` (Google Safe Browsing)
   - `src/lib/dns-checker.ts` (Node.js dns)
   - `src/lib/html-validator.ts` (W3C Validator)
   - `src/lib/page-analyzer.ts` (Analytics/CTA/trust tespiti)
3. `src/lib/scoring.ts` → 8 kategori puanlama motoru
4. `src/app/api/analyze/route.ts` → Pipeline 3→8+ paralel çağrı
5. `src/components/score-card.tsx` → SVG skor kartı bileşeni
6. `src/components/analysis-result.tsx` → Tamamen yeni rapor UI
7. `src/app/page.tsx` → Landing page güncelleme
8. `.env.local` + `.env.example` → Google API key setup
9. Build & test

### Dokunulmayacak Dosyalar
- crawler.ts, pagespeed.ts, ssl-checker.ts, tech-detector.ts, link-checker.ts, url-input.tsx

### Notion Sayfa ID'leri
- Launch Pilot Web: 2f8e5607-3cba-8079-a9f1-f4daeee833ce
- Part 1 Sprint Tasks DB: 2fde5607-3cba-810a-a471-c494826d3657
- API Entegrasyonları DB: 2fde5607-3cba-819d-9a6b-f5133fd242c1
- Puanlama Sistemi DB: 2fde5607-3cba-81d9-b404-f47b9dda7056
- Dosya Değişiklikleri DB: 2fde5607-3cba-81c4-826e-d934c07e24b7
- Sitalyze Karşılaştırma DB: 2fde5607-3cba-815d-87f8-d9b217185480

### Part 3: Dijital Varlık (Online Presence) — TAMAMLANDI (5 Şubat 2026)
- 9. puanlama kategorisi: "Dijital Varlık" (%10 ağırlık)
- Yeni modül: `src/lib/online-presence.ts` (5 fonksiyon)
- API'ler: Serper (Google index/brand), Wayback CDX (snapshot tarihçesi), HEAD (sosyal profil), HTML parse (webmaster tags)
- 7 yeni interface (`types.ts`), scoreOnlinePresence (`scoring.ts`), 7 öneri (`recommendations.ts`), 3 validation (`validator.ts`)
- Ağırlıklar 8→9 kategori: performance/seo 0.20→0.18, security 0.15→0.14, diğerleri 0.10→0.09, technology 0.05→0.04
- Fallback: SERPER_API_KEY yoksa → noData: true, skor hesabına dahil edilmez
- `.env.example`'a SERPER_API_KEY eklendi

### Sitalyze Yakınlaşma
- Şu an: %29 (8/28 özellik)
- Part 1 sonrası: %86 (18/21 özellik)
- Part 2-3: Auth, ödeme, PDF, AI önerileri, zamanlanmış tarama
