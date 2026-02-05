import type {
  CrawlResult,
  PageSpeedResult,
  SSLInfo,
  DomainInfo,
  SecurityHeadersResult,
  SafeBrowsingResult,
  DNSResult,
  HTMLValidationResult,
  PageAnalysis,
  ScoringResult,
  Recommendation,
  OnlinePresenceResult,
} from "./types";

function priorityWeight(p: Recommendation["priority"]): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[p];
}

export function generateRecommendations(
  crawl: CrawlResult,
  pageSpeed: PageSpeedResult,
  ssl: SSLInfo,
  domainInfo: DomainInfo,
  securityHeaders: SecurityHeadersResult,
  safeBrowsing: SafeBrowsingResult,
  dns: DNSResult,
  htmlValidation: HTMLValidationResult,
  pageAnalysis: PageAnalysis,
  scoring: ScoringResult,
  onlinePresence?: OnlinePresenceResult,
  crawlReliable: boolean = true
): Recommendation[] {
  const recs: Recommendation[] = [];

  // ── Performance ──
  if (scoring.categories.performance.score < 50) {
    recs.push({
      category: "Performans",
      priority: "critical",
      title: "Performans kritik düzeyde düşük",
      description: "Görselleri sıkıştır (WebP/AVIF), kullanılmayan JS/CSS'leri kaldır, lazy loading ekle.",
      howTo: "1. Görselleri TinyPNG veya Squoosh ile sıkıştır, WebP formatına çevir.\n2. WordPress kullanıyorsan WP Rocket veya Autoptimize eklentisi kur.\n3. Görsellere loading=\"lazy\" ekle (WordPress'te varsayılan olarak gelir).\n4. Kullanılmayan CSS/JS dosyalarını tespit edip kaldır — web geliştiricine söyle.",
      effort: "Zor",
    });
  }
  if (pageSpeed.webVitals.lcp && pageSpeed.webVitals.lcp > 4000) {
    recs.push({
      category: "Performans",
      priority: "high",
      title: "LCP çok yavaş (>4s)",
      description: "Hero görseli optimize et, sunucu yanıt süresini düşür, kritik CSS'i inline yap.",
      howTo: "1. Sayfanın en üstündeki büyük görseli (hero image) sıkıştır ve boyutunu küçült.\n2. Görseli WebP formatında kaydet.\n3. Hosting'ini daha hızlı bir sunucuya taşı veya CDN (Cloudflare gibi) kullan.\n4. Bu işlemler teknik bilgi gerektiriyorsa web geliştiricine söyle.",
      effort: "Zor",
    });
  }
  if (pageSpeed.webVitals.cls && pageSpeed.webVitals.cls > 0.25) {
    recs.push({
      category: "Performans",
      priority: "high",
      title: "CLS yüksek — sayfa kayıyor",
      description: "Görsellere width/height ekle, font-display: swap kullan, dinamik içeriklere yer ayır.",
      howTo: "1. Tüm <img> etiketlerine width ve height değeri ekle (görselin gerçek boyutlarını yaz).\n2. Reklam veya banner alanları için sabit yükseklik belirle.\n3. Web fontları yüklenirken sayfa kaymaması için font-display: swap kullan.\n4. Bu değişiklikleri web geliştiricine söyle.",
      effort: "Zor",
    });
  }
  if (pageSpeed.webVitals.ttfb && pageSpeed.webVitals.ttfb > 1800) {
    recs.push({
      category: "Performans",
      priority: "medium",
      title: "Sunucu yanıt süresi yüksek (TTFB)",
      description: "CDN kullan, sunucu tarafı cache ekle, veritabanı sorgularını optimize et.",
      howTo: "1. Cloudflare gibi ücretsiz bir CDN hizmeti kur — siteyi dünya genelinde hızlandırır.\n2. WordPress kullanıyorsan WP Super Cache veya W3 Total Cache eklentisi kur.\n3. Hosting firmanla iletişime geç — daha hızlı bir paket veya sunucu öner.\n4. Veritabanı optimizasyonu için web geliştiricine danış.",
      effort: "Zor",
    });
  }

  // ── SEO ──
  // noindex kontrolü (robots meta HTML'den gelir ama noindex varsa gerçekten kritik — her zaman kontrol et)
  const robotsMeta = crawl.metaSEO.robots?.toLowerCase() || "";
  if (crawlReliable && robotsMeta.includes("noindex")) {
    recs.push({
      category: "SEO",
      priority: "critical",
      title: "noindex aktif — sayfa arama motorlarında görünmüyor",
      description: "Meta robots tag'inde 'noindex' var. Site yayına hazırsa bu tag'i kaldır, aksi halde Google bu sayfayı indexlemez.",
      howTo: "1. WordPress kullanıyorsan: Ayarlar → Okuma → 'Arama motorlarını engelle' seçeneğinin işaretli OLMADIĞINDAN emin ol.\n2. Yoast SEO eklentisi varsa: sayfanın SEO ayarlarından 'Arama motorlarının bu sayfayı göstermesine izin ver' seçeneğini 'Evet' yap.\n3. Manuel HTML'de <meta name=\"robots\" content=\"noindex\"> satırını bul ve kaldır.\n4. Emin değilsen web geliştiricine söyle: 'noindex tag'ini kaldır'.",
      effort: "Kolay",
    });
  }

  // robots.txt Disallow: / kontrolü (tam satır eşleşmesi — "Disallow: /path" yanlış tetiklemesin)
  const robotsTxtLines = (crawl.technical.robotsTxtContent || "").split(/\r?\n/);
  const hasFullDisallow = robotsTxtLines.some((line) => /^\s*disallow:\s*\/\s*$/i.test(line));
  if (hasFullDisallow) {
    recs.push({
      category: "SEO",
      priority: "critical",
      title: "robots.txt tüm tarayıcıları engelliyor",
      description: "robots.txt dosyasında 'Disallow: /' kuralı var. Bu, arama motorlarının hiçbir sayfayı taramasına izin vermiyor.",
      howTo: "1. Site kök dizinindeki robots.txt dosyasını aç.\n2. 'Disallow: /' satırını 'Disallow:' (boş) olarak değiştir veya tamamen sil.\n3. WordPress kullanıyorsan: Yoast SEO → Araçlar → Dosya Düzenleyici → robots.txt'den düzenle.\n4. Değişiklikten sonra Google Search Console'dan yeniden tarama iste.",
      effort: "Kolay",
    });
  }

  if (crawlReliable && !crawl.basicInfo.title) {
    recs.push({
      category: "SEO",
      priority: "critical",
      title: "Sayfa başlığı (title) yok",
      description: "Her sayfaya benzersiz, 30-60 karakter arası bir <title> tag'i ekle.",
      howTo: "1. WordPress kullanıyorsan: Yoast SEO veya Rank Math eklentisini kur.\n2. Eklentide sayfanın 'SEO Başlığı' alanına açıklayıcı bir başlık yaz (30-60 karakter).\n3. Manuel HTML'de <head> bölümüne <title>Başlığınız</title> ekle.\n4. Her sayfada farklı, o sayfayı anlatan bir başlık kullan.",
      effort: "Kolay",
    });
  } else if (crawlReliable && (crawl.basicInfo.title.length < 30 || crawl.basicInfo.title.length > 60)) {
    recs.push({
      category: "SEO",
      priority: "medium",
      title: `Başlık uzunluğu ideal değil (${crawl.basicInfo.title.length} karakter)`,
      description: "Başlık 30-60 karakter arası olmalı. Anahtar kelimeyi başa yakın yerleştir.",
      howTo: "1. Başlığını 30-60 karakter arasına getir.\n2. En önemli anahtar kelimeyi başlığın başına yaz.\n3. WordPress + Yoast SEO kullanıyorsan 'SEO Başlığı' alanından düzenle.\n4. Örnek format: 'Anahtar Kelime — Marka Adı'",
      effort: "Kolay",
    });
  }
  if (crawlReliable && !crawl.basicInfo.metaDescription) {
    recs.push({
      category: "SEO",
      priority: "high",
      title: "Meta açıklama eksik",
      description: "120-160 karakter arası, sayfayı özetleyen ve tıklamaya teşvik eden bir meta description ekle.",
      howTo: "1. WordPress + Yoast SEO kullanıyorsan: Sayfanın altındaki 'Meta Açıklama' alanına yaz.\n2. 120-160 karakter arası, sayfanın ne hakkında olduğunu açıklayan bir metin yaz.\n3. Anahtar kelimeyi doğal şekilde içine yerleştir.\n4. Manuel HTML'de <head> içine <meta name=\"description\" content=\"Açıklamanız\"> ekle.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && crawl.headings.totalH1 === 0) {
    recs.push({
      category: "SEO",
      priority: "high",
      title: "H1 başlığı yok",
      description: "Her sayfada tek bir H1 başlığı olmalı. Ana anahtar kelimeyi H1'e ekle.",
      howTo: "1. Sayfanın ana başlığını <h1> etiketi ile sar.\n2. WordPress kullanıyorsan sayfa/yazı başlığı otomatik H1 olur — temayı kontrol et.\n3. Her sayfada sadece 1 tane H1 kullan.\n4. H1'e sayfanın ana konusunu anlatan anahtar kelimeyi ekle.",
      effort: "Kolay",
    });
  } else if (crawlReliable && crawl.headings.totalH1 > 1) {
    recs.push({
      category: "SEO",
      priority: "medium",
      title: `${crawl.headings.totalH1} adet H1 var`,
      description: "Sayfa başına tek H1 kullan. Diğerlerini H2 veya H3'e dönüştür.",
      howTo: "1. Sayfada sadece 1 H1 bırak — en önemli başlığı seç.\n2. Diğer H1'leri H2 veya H3 olarak değiştir.\n3. WordPress kullanıyorsan sayfa düzenleyicisinden başlık seviyelerini ayarla.\n4. Emin değilsen web geliştiricine 'fazla H1'leri H2'ye çevir' de.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && !crawl.metaSEO.canonical) {
    recs.push({
      category: "SEO",
      priority: "medium",
      title: "Canonical URL eksik",
      description: 'Duplicate content sorununu önlemek için <link rel="canonical"> ekle.',
      howTo: "1. WordPress + Yoast SEO kullanıyorsan otomatik eklenir — eklentinin aktif olduğunu kontrol et.\n2. Manuel HTML'de <head> içine <link rel=\"canonical\" href=\"https://siteniz.com/sayfa\"> ekle.\n3. Her sayfanın kendi URL'sini canonical olarak göster.\n4. www ve www olmayan versiyonların aynı sayfayı gösterdiğinden emin ol.",
      effort: "Orta",
    });
  }
  if (crawlReliable && Object.keys(crawl.metaSEO.ogTags).length < 3) {
    recs.push({
      category: "SEO",
      priority: "low",
      title: "Open Graph tag'leri eksik/yetersiz",
      description: "og:title, og:description, og:image ekle — sosyal medyada paylaşım görünümünü iyileştirir.",
      howTo: "1. WordPress + Yoast SEO kullanıyorsan 'Sosyal' sekmesinden başlık, açıklama ve görsel ekle.\n2. Manuel HTML'de <head> içine şunları ekle:\n   - <meta property=\"og:title\" content=\"Başlık\">\n   - <meta property=\"og:description\" content=\"Açıklama\">\n   - <meta property=\"og:image\" content=\"https://siteniz.com/gorsel.jpg\">\n3. Görselin en az 1200x630 piksel olmasına dikkat et.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && !crawl.technical.hasSitemap) {
    recs.push({
      category: "SEO",
      priority: "high",
      title: "Sitemap yok",
      description: "XML sitemap oluştur ve Google Search Console'a gönder. Arama motorlarının tüm sayfaları bulmasını sağlar.",
      howTo: "1. WordPress kullanıyorsan: Yoast SEO otomatik sitemap oluşturur — siteniz.com/sitemap_index.xml adresinden kontrol et.\n2. WordPress değilse: xml-sitemaps.com sitesinden ücretsiz sitemap oluştur ve kök dizine yükle.\n3. Google Search Console'a gir → Sitemap'ler → sitemap URL'ni gönder.\n4. robots.txt dosyasına 'Sitemap: https://siteniz.com/sitemap.xml' satırını ekle.",
      effort: "Orta",
    });
  }
  if (crawlReliable && !crawl.technical.hasRobotsTxt) {
    recs.push({
      category: "SEO",
      priority: "medium",
      title: "Robots.txt yok",
      description: "robots.txt oluştur. Arama motorlarına hangi sayfaları tarayabileceğini söyler.",
      howTo: "1. Basit bir metin dosyası oluştur, adını 'robots.txt' koy.\n2. İçine şunu yaz:\n   User-agent: *\n   Allow: /\n   Sitemap: https://siteniz.com/sitemap.xml\n3. Dosyayı sitenin kök dizinine (ana klasör) yükle.\n4. WordPress kullanıyorsan: Yoast SEO → Araçlar → Dosya Düzenleyici'den oluştur.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && !crawl.technical.hasSchemaOrg) {
    recs.push({
      category: "SEO",
      priority: "medium",
      title: "Yapılandırılmış veri (Schema) yok",
      description: "JSON-LD formatında Schema.org markup'ı ekle. Google'da zengin sonuçlar (rich snippets) kazanırsın.",
      howTo: "1. WordPress kullanıyorsan: Rank Math veya Schema Pro eklentisi kur — otomatik schema ekler.\n2. Manuel olarak: Google'ın Structured Data Markup Helper aracını kullan.\n3. En azından Organization ve WebSite schema'sı ekle.\n4. schema.markup-validator.com ile test et.\n5. Teknik detaylar için web geliştiricine danış.",
      effort: "Orta",
    });
  }

  // ── Security ──
  if (!crawl.security.isHttps) {
    recs.push({
      category: "Güvenlik",
      priority: "critical",
      title: "HTTPS aktif değil",
      description: "Hemen SSL sertifikası kur. Let's Encrypt ücretsiz sertifika sağlar. HTTPS olmadan Google sıralama cezası verir.",
      howTo: "1. Hosting panelinize girin (cPanel, Plesk vb.).\n2. 'SSL/TLS' veya 'Güvenlik' bölümünü bulun.\n3. 'Ücretsiz SSL' veya 'Let's Encrypt' seçeneğini aktifleştirin.\n4. Çoğu hosting firması tek tıkla SSL kurmayı destekler.\n5. Olmazsa hosting firmanızı arayın — size yardımcı olurlar.",
      effort: "Orta",
    });
  }
  if (!ssl.valid) {
    recs.push({
      category: "Güvenlik",
      priority: "critical",
      title: "SSL sertifikası geçersiz",
      description: "SSL sertifikasını yenile veya düzelt. Ziyaretçiler 'güvenli değil' uyarısı görüyor.",
      howTo: "1. Hosting panelinize girin.\n2. SSL/TLS bölümünden mevcut sertifikayı kontrol edin.\n3. Süresi dolmuşsa 'Yenile' butonuna tıklayın.\n4. Let's Encrypt kullanıyorsanız otomatik yenileme ayarını kontrol edin.\n5. Sorun devam ederse hosting firmanızı arayın.",
      effort: "Orta",
    });
  }
  if (ssl.daysUntilExpiry !== null && ssl.daysUntilExpiry <= 30) {
    recs.push({
      category: "Güvenlik",
      priority: "high",
      title: `SSL sertifikası ${ssl.daysUntilExpiry} gün içinde bitiyor`,
      description: "Sertifikayı şimdi yenile. Otomatik yenileme (auto-renewal) ayarla.",
      howTo: "1. Hosting panelinize girin → SSL/TLS bölümü.\n2. Sertifikayı hemen yenileyin.\n3. 'Otomatik Yenileme' seçeneğini aktif edin — böylece bir daha unutmazsınız.\n4. Let's Encrypt kullanıyorsanız certbot renew komutu ile otomatik yenileme kurulabilir.\n5. Emin değilseniz hosting firmanızı arayın.",
      effort: "Kolay",
    });
  }
  if (securityHeaders.missingHeaders.length > 0) {
    const missing = securityHeaders.missingHeaders.slice(0, 3).join(", ");
    recs.push({
      category: "Güvenlik",
      priority: "high",
      title: `${securityHeaders.missingHeaders.length} güvenlik header'ı eksik`,
      description: `Eksik: ${missing}. Bu header'lar XSS, clickjacking gibi saldırıları önler.`,
      howTo: "1. Bu ayar sunucu yapılandırması gerektirir — web geliştiricine söyle.\n2. WordPress kullanıyorsan: 'HTTP Headers' veya 'Security Headers' eklentisi kur.\n3. Cloudflare kullanıyorsan: Rules → Transform Rules bölümünden header ekleyebilirsin.\n4. securityheaders.com adresinden eksik header'ları kontrol edebilirsin.",
      effort: "Zor",
    });
  }
  if (crawl.security.hasMixedContent) {
    recs.push({
      category: "Güvenlik",
      priority: "high",
      title: "Mixed content sorunu var",
      description: "HTTP kaynakları HTTPS'e çevir. Tarayıcılar mixed content'i engelleyebilir.",
      howTo: "1. Sayfadaki http:// ile başlayan link ve görselleri https:// olarak değiştir.\n2. WordPress kullanıyorsan: 'Really Simple SSL' eklentisini kur — otomatik düzeltir.\n3. Veritabanındaki eski http:// linklerini toplu değiştirmek için 'Better Search Replace' eklentisi kullan.\n4. Tarayıcının geliştirici konsolunda (F12) hangi kaynakların http olduğunu görebilirsin.",
      effort: "Orta",
    });
  }
  if (!safeBrowsing.safe) {
    recs.push({
      category: "Güvenlik",
      priority: "critical",
      title: "Google Safe Browsing tehdit algıladı",
      description: "Site zararlı olarak işaretlenmiş. Google Search Console'dan detayları kontrol et ve temizle.",
      howTo: "1. Google Search Console'a girin → Güvenlik ve Manuel İşlemler bölümü.\n2. Tespit edilen tehditleri inceleyin.\n3. Zararlı kodları temizleyin — Sucuri veya Wordfence eklentisi ile tarama yapın.\n4. Temizleme sonrası Search Console'dan 'İnceleme İste' butonuna tıklayın.\n5. Acil durumdur — web geliştiricine hemen söyleyin.",
      effort: "Zor",
    });
  }

  // ── Accessibility ── (HTML'e bağlı — crawl güvenilir olmalı)
  if (crawlReliable && crawl.images.totalMissingAlt > 0) {
    recs.push({
      category: "Erişilebilirlik",
      priority: crawl.images.totalMissingAlt > 5 ? "high" : "medium",
      title: `${crawl.images.totalMissingAlt} görselde alt tag eksik`,
      description: "Her görsele açıklayıcı alt text ekle. Ekran okuyucular ve SEO için önemli.",
      howTo: "1. WordPress kullanıyorsan: Medya → Kütüphane'den her görseli seç ve 'Alternatif Metin' alanını doldur.\n2. Görselin ne gösterdiğini kısaca açıkla (örn: 'Kırmızı spor araba yan görünüm').\n3. Dekoratif görseller için alt=\"\" (boş) bırakabilirsin.\n4. Manuel HTML'de <img src=\"...\" alt=\"Açıklama\"> şeklinde ekle.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && !crawl.basicInfo.language) {
    recs.push({
      category: "Erişilebilirlik",
      priority: "medium",
      title: "HTML lang attribute eksik",
      description: '<html lang="tr"> ekle. Ekran okuyucuların doğru dili kullanmasını sağlar.',
      howTo: "1. HTML dosyanın en başındaki <html> etiketine lang=\"tr\" ekle: <html lang=\"tr\">\n2. WordPress kullanıyorsan: Ayarlar → Genel → Site Dili'ni 'Türkçe' yap.\n3. Farklı dil kullanıyorsan uygun dil kodunu yaz (en, de, fr vb.).\n4. Bu değişiklik tek satırlık — web geliştiricine söyle.",
      effort: "Kolay",
    });
  }

  // ── Best Practices ──
  if (htmlValidation.errors > 10) {
    recs.push({
      category: "Best Practices",
      priority: "high",
      title: `${htmlValidation.errors} HTML doğrulama hatası`,
      description: "W3C Validator ile hataları düzelt. Geçersiz HTML tarayıcılarda sorun çıkarabilir.",
      howTo: "1. validator.w3.org adresine git ve site URL'ni yapıştır.\n2. Hataları listele ve en kritik olanlardan başlayarak düzelt.\n3. Kapanmamış etiketler, yanlış iç içe geçme gibi sorunlara bak.\n4. Bu işlem teknik bilgi gerektirir — web geliştiricine hata listesini göster.",
      effort: "Zor",
    });
  } else if (htmlValidation.errors > 0) {
    recs.push({
      category: "Best Practices",
      priority: "low",
      title: `${htmlValidation.errors} HTML hatası`,
      description: "Küçük HTML hatalarını düzelt. validator.w3.org ile kontrol et.",
      howTo: "1. validator.w3.org adresine git ve site URL'ni yapıştır.\n2. Az sayıda hata var — genelde kapanmamış etiketler veya eksik attribute'lar.\n3. Hataları tek tek düzelt.\n4. Web geliştiricine 'W3C validator hatalarını düzelt' de.",
      effort: "Orta",
    });
  }
  if (crawlReliable && !crawl.basicInfo.favicon) {
    recs.push({
      category: "Best Practices",
      priority: "low",
      title: "Favicon eksik",
      description: "Bir favicon ekle. Tarayıcı sekmesinde ve yer imlerinde görünür, profesyonellik katar.",
      howTo: "1. Logonu 32x32 veya 16x16 piksel boyutunda .ico veya .png formatında kaydet.\n2. favicon.io sitesinden metin veya görsel ile favicon oluşturabilirsin.\n3. Dosyayı site kök dizinine 'favicon.ico' olarak yükle.\n4. WordPress kullanıyorsan: Görünüm → Özelleştir → Site Kimliği → Site Simgesi'nden yükle.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && crawl.links.totalBroken > 0) {
    recs.push({
      category: "Best Practices",
      priority: "high",
      title: `${crawl.links.totalBroken} kırık link var`,
      description: "Kırık linkleri düzelt veya kaldır. Kullanıcı deneyimini ve SEO'yu olumsuz etkiler.",
      howTo: "1. Yukarıdaki raporda listelenen kırık linkleri not al.\n2. Her birini doğru URL'ye güncelle veya sayfadan kaldır.\n3. WordPress kullanıyorsan: 'Broken Link Checker' eklentisini kur — otomatik bulur.\n4. Silinen sayfalar için 301 yönlendirme kur — web geliştiricine söyle.",
      effort: "Orta",
    });
  }

  // ── Domain Trust ── (trust signals HTML'e bağlı — crawl güvenilir olmalı)
  if (crawlReliable && !pageAnalysis.trustSignals.hasPrivacyPolicy) {
    recs.push({
      category: "Domain Güven",
      priority: "high",
      title: "Gizlilik politikası sayfası yok",
      description: "KVKK/GDPR uyumu için gizlilik politikası sayfası ekle. Güven sinyali olarak da önemli.",
      howTo: "1. kvkk.gov.tr veya ücretsiz gizlilik politikası oluşturucu sitelerinden şablon al.\n2. Yeni bir sayfa oluştur ve politika metnini yapıştır.\n3. Footer'a (alt kısım) 'Gizlilik Politikası' linki ekle.\n4. Firma adı, iletişim bilgileri ve veri işleme amaçlarını özelleştir.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && !pageAnalysis.trustSignals.hasTerms) {
    recs.push({
      category: "Domain Güven",
      priority: "medium",
      title: "Kullanım koşulları sayfası yok",
      description: "Kullanım koşulları sayfası ekle. Yasal koruma ve güvenilirlik sağlar.",
      howTo: "1. Ücretsiz kullanım koşulları şablonu indir veya hukuk danışmanına oluşturmasını söyle.\n2. Yeni bir sayfa oluştur ve metni yapıştır.\n3. Footer'a 'Kullanım Koşulları' linki ekle.\n4. E-ticaret sitesiysen iade ve iptal koşullarını da ekle.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && !pageAnalysis.trustSignals.hasContactInfo) {
    recs.push({
      category: "Domain Güven",
      priority: "high",
      title: "İletişim bilgisi bulunamadı",
      description: "E-posta, telefon veya adres bilgisi ekle. Ziyaretçilerin sana ulaşabilmesi güven oluşturur.",
      howTo: "1. Footer'a veya 'İletişim' sayfasına e-posta, telefon ve adres bilgini ekle.\n2. Bir iletişim formu oluştur — WordPress'te Contact Form 7 veya WPForms kullanabilirsin.\n3. Google Maps haritası eklersen daha da güvenilir görünür.\n4. En azından bir e-posta adresi bile yeterli.",
      effort: "Kolay",
    });
  }
  if (!dns.hasSPF) {
    recs.push({
      category: "Domain Güven",
      priority: "medium",
      title: "SPF kaydı yok",
      description: "DNS'e SPF kaydı ekle. E-posta sahteciliğini (spoofing) önler.",
      howTo: "1. Domain sağlayıcının (GoDaddy, Namecheap vb.) DNS yönetim paneline gir.\n2. Yeni bir TXT kaydı ekle.\n3. Değer olarak şunu gir: v=spf1 include:_spf.google.com ~all (Gmail kullanıyorsan).\n4. Farklı e-posta sağlayıcısı kullanıyorsan onların SPF değerini kullan.\n5. Emin değilsen hosting firmanı ara.",
      effort: "Orta",
    });
  }
  if (!dns.hasDMARC) {
    recs.push({
      category: "Domain Güven",
      priority: "medium",
      title: "DMARC kaydı yok",
      description: "DNS'e DMARC kaydı ekle. SPF ile birlikte e-posta güvenliğini tamamlar.",
      howTo: "1. DNS yönetim panelinde yeni bir TXT kaydı ekle.\n2. Host/Ad alanına: _dmarc\n3. Değer olarak: v=DMARC1; p=none; rua=mailto:senin@email.com\n4. Bu, e-posta raporlarını sana gönderir ve sahteciliği izlemeye başlar.\n5. Emin değilsen hosting firmanı veya web geliştiricini ara.",
      effort: "Orta",
    });
  }
  if (crawlReliable && pageAnalysis.socialLinks.length === 0) {
    recs.push({
      category: "Domain Güven",
      priority: "low",
      title: "Sosyal medya linki yok",
      description: "Sosyal medya hesap linklerini footer'a ekle. Marka güvenilirliğini artırır.",
      howTo: "1. Footer'a (sayfa alt kısmı) sosyal medya ikonlarını ekle.\n2. Instagram, Twitter/X, LinkedIn, Facebook gibi aktif hesaplarının linklerini bağla.\n3. WordPress kullanıyorsan tema ayarlarından veya widget'lardan ekleyebilirsin.\n4. İkonları siteden bulabilirsin: fontawesome.com veya simpleicons.org",
      effort: "Kolay",
    });
  }

  // Cookie consent kontrolü
  if (crawlReliable && !pageAnalysis.cookieConsent.detected) {
    recs.push({
      category: "Domain Güven",
      priority: "medium",
      title: "Cookie consent/banner bulunamadı",
      description: "KVKK/GDPR uyumluluğu için çerez bilgilendirme banner'ı ekle. Cookiebot, OneTrust gibi araçlar kullanabilirsin.",
      howTo: "1. Cookiebot.com'a ücretsiz kayıt ol — 100 sayfaya kadar ücretsiz.\n2. Sana verilen kodu sitenin <head> bölümüne yapıştır.\n3. WordPress kullanıyorsan: 'CookieYes' veya 'Complianz' eklentisini kur.\n4. Banner otomatik çıkacak ve ziyaretçiden çerez izni isteyecek.",
      effort: "Orta",
    });
  }

  // ── Content ── (HTML'e bağlı)
  if (crawlReliable && crawl.content.wordCount < 50) {
    recs.push({
      category: "İçerik",
      priority: "critical",
      title: `Site henüz beslenmemiş (${crawl.content.wordCount} kelime)`,
      description: "Sayfada neredeyse hiç içerik yok. İçerik üretmeye başla — arama motorları ve ziyaretçiler için minimum 300 kelime hedefle.",
      howTo: "1. Sayfanın amacını belirle — ne satıyorsun veya ne anlatıyorsun?\n2. En az 300 kelimelik, konuyu açıklayan bir metin yaz.\n3. Başlık (H1), alt başlıklar (H2) ve paragraflar kullan.\n4. Anahtar kelimelerini doğal şekilde metne yerleştir.\n5. ChatGPT veya benzeri araçlarla taslak oluşturup üzerinde düzenleme yapabilirsin.",
      effort: "Orta",
    });
  } else if (crawlReliable && crawl.content.wordCount < 300) {
    recs.push({
      category: "İçerik",
      priority: crawl.content.wordCount < 100 ? "high" : "medium",
      title: `İçerik çok az (${crawl.content.wordCount} kelime)`,
      description: "Sayfaya daha fazla kaliteli içerik ekle. Minimum 300 kelime hedefle.",
      howTo: "1. Mevcut içeriğin üzerine ekle — konuyu daha detaylı açıkla.\n2. SSS (Sıkça Sorulan Sorular) bölümü ekle.\n3. Hizmetlerini veya ürünlerini daha detaylı anlat.\n4. Minimum 300, ideal 500+ kelime hedefle.\n5. İçerik yazarken doğal bir dil kullan — anahtar kelime doldurmaktan kaçın.",
      effort: "Orta",
    });
  }
  if (crawlReliable && crawl.images.total === 0) {
    recs.push({
      category: "İçerik",
      priority: "medium",
      title: "Sayfada görsel yok",
      description: "İlgili görseller ekle. Görsel içerik kullanıcı etkileşimini artırır.",
      howTo: "1. Konuyla ilgili kaliteli görseller bul — Unsplash veya Pexels ücretsiz kaynaklar.\n2. Görselleri sıkıştır (TinyPNG) ve sayfaya ekle.\n3. Her görsele alt text yaz.\n4. Hero bölümüne büyük, dikkat çekici bir görsel koy.\n5. WordPress'te Medya → Yeni Ekle ile yükle.",
      effort: "Kolay",
    });
  }
  if (crawlReliable && crawl.links.totalInternal < 3) {
    recs.push({
      category: "İçerik",
      priority: "medium",
      title: "İç link sayısı az",
      description: "Diğer sayfalarına iç linkler ekle. SEO ve kullanıcı navigasyonu için önemli.",
      howTo: "1. Sayfa içeriğinde diğer sayfalarına doğal linkler ekle.\n2. Örneğin: 'Hizmetlerimiz hakkında detaylı bilgi için tıklayın' gibi.\n3. Menü ve footer'da tüm önemli sayfalarına link ver.\n4. İlgili blog yazılarına çapraz link ver.\n5. En az 3-5 iç link hedefle.",
      effort: "Kolay",
    });
  }

  // ── Technology ── (HTML'e bağlı)
  if (crawlReliable && !pageAnalysis.analytics.hasGoogleAnalytics && !pageAnalysis.analytics.hasGTM) {
    recs.push({
      category: "Teknoloji",
      priority: "high",
      title: "Analytics yok",
      description: "Google Analytics veya GTM kur. Ziyaretçi verisi olmadan iyileştirme yapamazsın.",
      howTo: "1. analytics.google.com adresine git ve ücretsiz hesap oluştur.\n2. 'GA4 Mülk' oluştur ve verilen izleme kodunu kopyala.\n3. Kodu sitenin <head> bölümüne yapıştır.\n4. WordPress kullanıyorsan: 'Site Kit by Google' eklentisini kur — tek tıkla bağla.\n5. GTM tercih edersen: tagmanager.google.com'dan hesap oluştur ve kodunu ekle.",
      effort: "Orta",
    });
  }

  // ── Dijital Varlık ──
  if (onlinePresence && !onlinePresence.googleIndex.noData) {
    const gi = onlinePresence.googleIndex;
    const wb = onlinePresence.waybackHistory;
    const wm = onlinePresence.webmasterTags;
    const sp = onlinePresence.socialPresence;
    const sd = onlinePresence.structuredData;

    // 1. Google'da indexli değil
    if (!gi.isIndexed) {
      recs.push({
        category: "Dijital Varlık",
        priority: "critical",
        title: "Site Google'da indexli değil",
        description: "Google bu siteyi tanımıyor. Search Console'a kayıt ol ve sitemap gönder.",
        howTo: "1. Google Search Console'a git (search.google.com/search-console).\n2. 'Mülk Ekle' ile domain'ini kaydet.\n3. DNS veya HTML tag ile doğrulamayı tamamla.\n4. Sitemap URL'ni gönder (siteniz.com/sitemap.xml).\n5. 'URL Denetimi' aracıyla ana sayfanı indexlenmesi için gönder.\n6. Indexlenme birkaç gün sürebilir — sabırlı ol.",
        effort: "Orta",
      });
    }

    // 2. Çok az sayfa indexli
    if (gi.isIndexed && gi.indexedPageCount < 10) {
      recs.push({
        category: "Dijital Varlık",
        priority: "high",
        title: `Çok az sayfa indexli (${gi.indexedPageCount})`,
        description: "Google sadece birkaç sayfanı biliyor. Sitemap oluştur ve iç linkleri güçlendir.",
        howTo: "1. Tüm sayfalarını içeren güncel bir sitemap.xml oluştur.\n2. Google Search Console'dan sitemap'i gönder.\n3. Sayfalar arasında iç linkler ekle — her sayfadan diğer önemli sayfalara link ver.\n4. Yeni içerik ekledikçe Search Console'dan 'URL Denetimi' ile gönder.\n5. robots.txt'in sayfaları engellemediğinden emin ol.",
        effort: "Orta",
      });
    }

    // 3. Google Search Console verification yok
    if (!wm.google) {
      recs.push({
        category: "Dijital Varlık",
        priority: "high",
        title: "Google Search Console doğrulaması yok",
        description: "Search Console verification tag'i bulunamadı. Kayıt olup doğrulama yapmalısın.",
        howTo: "1. Google Search Console'a git ve domain'ini ekle.\n2. 'HTML Etiketi' doğrulama yöntemini seç.\n3. Verilen <meta name=\"google-site-verification\" content=\"...\"> tag'ini sitenin <head> bölümüne ekle.\n4. WordPress kullanıyorsan: Yoast SEO → Genel → Webmaster Araçları → Google doğrulama kodu alanına yapıştır.\n5. Doğrulamayı tamamla.",
        effort: "Kolay",
      });
    }

    // 4. Kırık sosyal medya linkleri
    if (sp.totalInvalid > 0) {
      recs.push({
        category: "Dijital Varlık",
        priority: "medium",
        title: `${sp.totalInvalid} sosyal medya linki kırık`,
        description: "Erişilemeyen sosyal medya linkleri güvenilirliği düşürür. Düzelt veya kaldır.",
        howTo: "1. Sitendeki sosyal medya ikonlarını kontrol et.\n2. Tıklayıp doğru sayfaya gidip gitmediğini test et.\n3. Kırık linkleri güncel URL ile değiştir.\n4. Artık kullanmadığın platformların linklerini kaldır.\n5. WordPress'te genelde tema ayarları veya footer widget'ından düzenleyebilirsin.",
        effort: "Kolay",
      });
    }

    // 5. Brand mention yok
    if (gi.brandMentions === 0) {
      recs.push({
        category: "Dijital Varlık",
        priority: "medium",
        title: "İnternette marka bahsetmesi bulunamadı",
        description: "Dış sitelerde markan hakkında hiç bahis yok. Dijital PR ve guest post stratejisi uygula.",
        howTo: "1. Sektöründeki bloglara ve haber sitelerine misafir yazı (guest post) yaz.\n2. İş dizinlerine kayıt ol (Google Business Profile, Yelp, sektörel dizinler).\n3. Sosyal medyada düzenli paylaşım yap ve etiketlenmeleri teşvik et.\n4. Basın bülteni hizmeti kullan (PR Newswire, ücretsiz alternatifler mevcut).\n5. Müşterilerinden referans ve yorum iste.",
        effort: "Zor",
      });
    }

    // 6. OG tags eksik
    if (!sd.ogComplete) {
      recs.push({
        category: "Dijital Varlık",
        priority: "medium",
        title: "Open Graph tag'leri eksik/yetersiz",
        description: "Sosyal medyada paylaşım görünümü kötü olacak. og:title, og:description ve og:image ekle.",
        howTo: "1. WordPress + Yoast SEO kullanıyorsan: Her sayfanın 'Sosyal' sekmesinden OG ayarlarını doldur.\n2. Manuel HTML'de <head> içine şunları ekle:\n   - <meta property=\"og:title\" content=\"Sayfa Başlığı\">\n   - <meta property=\"og:description\" content=\"Sayfa açıklaması\">\n   - <meta property=\"og:image\" content=\"https://siteniz.com/gorsel.jpg\">\n3. og:image en az 1200x630 piksel olmalı.\n4. Facebook Sharing Debugger ile test et: developers.facebook.com/tools/debug",
        effort: "Kolay",
      });
    }

    // 7. Wayback'te snapshot yok
    if (wb.snapshotCount === 0) {
      recs.push({
        category: "Dijital Varlık",
        priority: "low",
        title: "Wayback Machine'de kayıt yok",
        description: "Site henüz arşivlenmemiş. Elle kayıt yaparak dijital iz bırak.",
        howTo: "1. web.archive.org/save adresine git.\n2. Site URL'ni gir ve 'Save Page' butonuna tıkla.\n3. Birkaç dakika bekle — sayfa arşivlenecek.\n4. Bu işlemi önemli güncellemelerden sonra tekrarla.\n5. Arşivlenmiş sayfalar, sitenin geçmişini kanıtlar ve güvenilirlik katar.",
        effort: "Kolay",
      });
    }
  }

  // Önceliğe göre sırala
  recs.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));

  return recs;
}
