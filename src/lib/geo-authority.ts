import type {
  CrawlResult,
  PageAnalysis,
  OnlinePresenceResult,
  GEOAuthorityReport,
  AuthoritySubScore,
} from "./types";

// ── Alt Skor Hesaplayıcılar ──

function scoreSEOFoundation(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Title var + uygun uzunluk → +4
  const titleLen = crawl.basicInfo.title?.length || 0;
  if (crawl.basicInfo.title && titleLen >= 30 && titleLen <= 60) {
    score += 4;
    details.push(`Title uygun uzunlukta (${titleLen} karakter)`);
  } else if (crawl.basicInfo.title) {
    score += 2;
    details.push(`Title var ama ${titleLen < 30 ? "kısa" : "uzun"} (${titleLen} karakter)`);
  } else {
    details.push("Title bulunamadı");
  }

  // Meta description var + uygun uzunluk → +4
  const descLen = crawl.basicInfo.metaDescription?.length || 0;
  if (crawl.basicInfo.metaDescription && descLen >= 120 && descLen <= 160) {
    score += 4;
    details.push(`Meta description uygun (${descLen} karakter)`);
  } else if (crawl.basicInfo.metaDescription) {
    score += 2;
    details.push(`Meta description var ama ${descLen < 120 ? "kısa" : "uzun"} (${descLen} karakter)`);
  } else {
    details.push("Meta description bulunamadı");
  }

  // Tek H1 → +4
  if (crawl.headings.totalH1 === 1) {
    score += 4;
    details.push("Tek H1 etiketi mevcut");
  } else if (crawl.headings.totalH1 > 1) {
    score += 2;
    details.push(`Birden fazla H1 (${crawl.headings.totalH1} adet)`);
  } else {
    details.push("H1 etiketi bulunamadı");
  }

  // Canonical var → +4
  if (crawl.metaSEO.canonical) {
    score += 4;
    details.push("Canonical URL tanımlı");
  } else {
    details.push("Canonical URL tanımlı değil");
  }

  // robots.txt + sitemap → +4
  if (crawl.technical.hasRobotsTxt && crawl.technical.hasSitemap) {
    score += 4;
    details.push("robots.txt ve sitemap.xml mevcut");
  } else if (crawl.technical.hasRobotsTxt || crawl.technical.hasSitemap) {
    score += 2;
    details.push(`${crawl.technical.hasRobotsTxt ? "robots.txt" : "sitemap.xml"} mevcut, diğeri eksik`);
  } else {
    details.push("robots.txt ve sitemap.xml bulunamadı");
  }

  return {
    score,
    max: 20,
    label: "SEO Temeli",
    details,
  };
}

function scoreStructuredData(crawl: CrawlResult, onlinePresence?: OnlinePresenceResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Schema.org var → +5
  if (crawl.technical.hasSchemaOrg) {
    score += 5;
    details.push(`Schema.org mevcut (${crawl.technical.schemaTypes.join(", ")})`);
  } else {
    details.push("Schema.org yapılandırılmamış");
  }

  // Article/FAQ/HowTo schema → +5
  const richTypes = crawl.technical.schemaTypes.filter(
    (t) => /article|faq|howto|product|breadcrumb/i.test(t)
  );
  if (richTypes.length >= 2) {
    score += 5;
    details.push(`Zengin schema türleri: ${richTypes.join(", ")}`);
  } else if (richTypes.length === 1) {
    score += 3;
    details.push(`Schema türü: ${richTypes[0]}`);
  } else if (crawl.technical.hasSchemaOrg) {
    score += 1;
    details.push("Schema var ama zengin tür (Article/FAQ/HowTo) yok");
  }

  // OG tags tam → +5
  const sd = onlinePresence?.structuredData;
  if (sd?.ogComplete) {
    score += 5;
    details.push("Open Graph etiketleri tam");
  } else {
    const ogCount = Object.keys(crawl.metaSEO.ogTags).length;
    if (ogCount > 0) {
      score += 2;
      details.push(`Open Graph kısmen mevcut (${ogCount} etiket)`);
    } else {
      details.push("Open Graph etiketleri bulunamadı");
    }
  }

  // JSON-LD + Twitter Card → +5
  let extraScore = 0;
  if (sd?.twitterCardComplete) {
    extraScore += 3;
    details.push("Twitter Card etiketleri tam");
  } else {
    const twCount = Object.keys(crawl.metaSEO.twitterTags).length;
    if (twCount > 0) {
      extraScore += 1;
      details.push(`Twitter Card kısmen mevcut (${twCount} etiket)`);
    } else {
      details.push("Twitter Card etiketleri bulunamadı");
    }
  }
  if (sd?.schemaComplete) {
    extraScore += 2;
    details.push("JSON-LD yapısı eksiksiz");
  }
  score += Math.min(extraScore, 5);

  return {
    score,
    max: 20,
    label: "Yapılandırılmış Veri",
    details,
  };
}

function scoreCitability(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Kelime sayısı ≥ 1500 → +5
  if (crawl.content.wordCount >= 1500) {
    score += 5;
    details.push(`Zengin içerik (${crawl.content.wordCount} kelime)`);
  } else if (crawl.content.wordCount >= 500) {
    score += 3;
    details.push(`Orta seviye içerik (${crawl.content.wordCount} kelime)`);
  } else {
    score += 1;
    details.push(`İçerik kısa (${crawl.content.wordCount} kelime)`);
  }

  // Paragraf sayısı ≥ 5 (bölümlü yapı) → +5
  if (crawl.content.paragraphCount >= 5) {
    score += 5;
    details.push(`Bölümlü yapı (${crawl.content.paragraphCount} paragraf)`);
  } else if (crawl.content.paragraphCount >= 2) {
    score += 2;
    details.push(`Az paragraf (${crawl.content.paragraphCount} adet)`);
  } else {
    details.push("Paragraf yapısı zayıf");
  }

  // H2 yapısı (içerik bölümleme) → +5
  if (crawl.headings.totalH2 >= 4) {
    score += 5;
    details.push(`İyi bölümleme (${crawl.headings.totalH2} H2 başlık)`);
  } else if (crawl.headings.totalH2 >= 2) {
    score += 3;
    details.push(`Bölümleme mevcut (${crawl.headings.totalH2} H2)`);
  } else {
    details.push("H2 başlık yapısı yetersiz");
  }

  // Dış kaynak linkleri → +5
  if (crawl.links.totalExternal >= 3) {
    score += 5;
    details.push(`Dış kaynak referansları var (${crawl.links.totalExternal} link)`);
  } else if (crawl.links.totalExternal >= 1) {
    score += 2;
    details.push(`Az dış kaynak (${crawl.links.totalExternal} link)`);
  } else {
    details.push("Dış kaynak referansı yok");
  }

  return {
    score,
    max: 20,
    label: "Cite Edilebilirlik",
    details,
  };
}

function scoreBrandMention(onlinePresence?: OnlinePresenceResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];
  let noData = false;

  if (!onlinePresence) {
    noData = true;
    details.push("Dijital varlık verisi alınamadı");
    return { score: 0, max: 20, label: "Marka Bahsetmeleri", details, noData };
  }

  // Brand mentions → +7
  const mentions = onlinePresence.googleIndex.brandMentions;
  if (onlinePresence.googleIndex.noData) {
    noData = true;
    details.push("Marka bahsetme verisi alınamadı (API key gerekli)");
  } else if (mentions >= 10) {
    score += 7;
    details.push(`Güçlü marka bilinirliği (${mentions} bahsetme)`);
  } else if (mentions >= 1) {
    score += 4;
    details.push(`Marka bahsetmeleri var ama az (${mentions} adet)`);
  } else {
    details.push("Marka bahsetmesi bulunamadı");
  }

  // Sosyal profiller → +6
  const verified = onlinePresence.socialPresence.totalVerified;
  if (verified >= 3) {
    score += 6;
    details.push(`Sosyal medya varlığı güçlü (${verified} doğrulanmış profil)`);
  } else if (verified >= 1) {
    score += 3;
    details.push(`Sosyal medya az (${verified} profil)`);
  } else {
    details.push("Doğrulanmış sosyal profil yok");
  }

  // Wayback geçmişi → +7
  const snapshots = onlinePresence.waybackHistory.snapshotCount;
  if (snapshots >= 10) {
    score += 7;
    details.push(`Web arşiv geçmişi güçlü (${snapshots} snapshot)`);
  } else if (snapshots >= 1) {
    score += 3;
    details.push(`Web arşiv geçmişi var (${snapshots} snapshot)`);
  } else {
    details.push("Web arşivinde kayıt bulunamadı");
  }

  return {
    score,
    max: 20,
    label: "Marka Bahsetmeleri",
    details,
    noData,
  };
}

function scoreLLMVisibility(crawl: CrawlResult, onlinePresence?: OnlinePresenceResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // noindex yok (LLM crawler'lar da robots'a bakar) → +5
  const hasNoindex = crawl.metaSEO.robots?.toLowerCase().includes("noindex") || false;
  if (!hasNoindex) {
    score += 5;
    details.push("noindex yok — LLM crawler'lar erişebilir");
  } else {
    details.push("noindex var — LLM crawler'lar bu sayfayı göremez");
  }

  // Canonical var (LLM'ler için tekil kaynak) → +4
  if (crawl.metaSEO.canonical) {
    score += 4;
    details.push("Canonical URL tanımlı — tekil kaynak belirli");
  } else {
    details.push("Canonical yok — LLM'ler kaynak belirsizliği yaşayabilir");
  }

  // Structured data completeness → +5
  const sd = onlinePresence?.structuredData;
  if (sd?.schemaComplete && sd?.ogComplete) {
    score += 5;
    details.push("JSON-LD ve Open Graph eksiksiz — AI tarafından kolay okunur");
  } else if (sd?.schemaComplete || sd?.ogComplete) {
    score += 3;
    details.push("Yapılandırılmış veri kısmen mevcut");
  } else if (crawl.technical.hasSchemaOrg) {
    score += 1;
    details.push("Schema var ama eksik — AI'lar tam çıkaramayabilir");
  } else {
    details.push("Yapılandırılmış veri yok — LLM'ler içerik çıkaramaz");
  }

  // İçerik zenginliği (LLM'ler uzun, yapılı içerik tercih eder) → +3
  if (crawl.content.wordCount >= 1000 && crawl.headings.totalH2 >= 3) {
    score += 3;
    details.push("İçerik zengin ve yapılı — LLM alıntılama potansiyeli yüksek");
  } else if (crawl.content.wordCount >= 300) {
    score += 1;
    details.push("İçerik mevcut ama LLM alıntılama potansiyeli düşük");
  } else {
    details.push("İçerik çok kısa — LLM'ler bu kaynağı tercih etmez");
  }

  // Sitemap var → +3
  if (crawl.technical.hasSitemap) {
    score += 3;
    details.push("Sitemap mevcut — LLM crawler'lar tüm içeriği bulabilir");
  } else {
    details.push("Sitemap yok — LLM crawler'lar sayfaları bulamayabilir");
  }

  return {
    score,
    max: 20,
    label: "LLM Görünürlüğü",
    details,
    noData: true, // Doğrudan LLM API verisi yok
  };
}

// ── Verdict ──

function determineVerdict(overall: number): GEOAuthorityReport["verdict"] {
  if (overall >= 70) return "onay";
  if (overall >= 50) return "guclendir";
  return "yeniden-yapilandir";
}

function determineColor(overall: number): GEOAuthorityReport["color"] {
  if (overall >= 80) return "green";
  if (overall >= 70) return "lime";
  if (overall >= 50) return "yellow";
  if (overall >= 30) return "orange";
  return "red";
}

// ── Community Insights ──

function selectCommunityInsights(categories: GEOAuthorityReport["categories"], overall: number): string[] {
  const insights: string[] = [];

  if (categories.seoFoundation.score < 12) {
    insights.push("Reddit: GEO'nun temeli yine SEO. Önce teknik altyapıyı sağlamlaştır.");
  }
  if (categories.structuredData.score < 10) {
    insights.push("Reddit: Schema markup olmadan AI arama motorları seni tanıyamaz. JSON-LD şart.");
  }
  if (categories.citability.score < 10) {
    insights.push("Reddit: LLM'ler kaynak gösterirken iyi yapılandırılmış, detaylı içerikleri tercih eder.");
  }
  if (categories.brandMention.score < 10) {
    insights.push("Reddit: AI araçları marka bilinirliğini web'deki bahsetmelerle ölçer — dijital PR önemli.");
  }
  if (categories.llmVisibility.score < 10) {
    insights.push("Reddit: ChatGPT ve benzeri araçlar robots.txt'e saygı duyar. Erişime açık olmalısın.");
  }
  if (overall >= 70) {
    insights.push("Reddit: GEO temeli sağlamsa, AI tarafından kaynak gösterilme şansın katlanarak artar.");
  }

  if (insights.length === 0) {
    insights.push("Reddit: AI arama motorları yükselirken GEO optimizasyonu artık opsiyonel değil.");
  }

  return insights;
}

// ── Action Plan ──

function buildActionPlan(verdict: GEOAuthorityReport["verdict"]): string[] {
  switch (verdict) {
    case "yeniden-yapilandir":
      return [
        "Hafta 1-2: Temel SEO düzeltmeleri (canonical, sitemap, robots) + JSON-LD ekleme",
        "Hafta 3: İçeriği bölümlü ve cite edilebilir hale getir (H2 yapısı, kaynak linkleri)",
        "Hafta 4: Sosyal profilleri ve marka bahsetmelerini güçlendir + rapor çıkar",
      ];
    case "guclendir":
      return [
        "Hafta 1: Eksik structured data'yı tamamla (FAQ/HowTo schema ekle)",
        "Hafta 2-3: İçeriği LLM-dostu formata dönüştür (kısa cevaplar, açık başlıklar)",
        "Hafta 4: Brand mention çalışması + AI görünürlük testi",
      ];
    case "onay":
      return [
        "Hafta 1-2: Mevcut içeriklere yapılandırılmış veri zenginleştirmesi",
        "Hafta 3: LLM alıntılama potansiyelini test et (ChatGPT/Perplexity'de ara)",
        "Hafta 4: Yeni GEO odaklı içerik + dijital PR stratejisi başlat",
      ];
  }
}

// ── Ana Fonksiyon ──

export function generateGEOAuthorityReport(
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  onlinePresence?: OnlinePresenceResult,
  crawlReliable?: boolean
): GEOAuthorityReport {
  const seoFoundation = scoreSEOFoundation(crawl);
  const structuredData = scoreStructuredData(crawl, onlinePresence);
  const citability = scoreCitability(crawl);
  const brandMention = scoreBrandMention(onlinePresence);
  const llmVisibility = scoreLLMVisibility(crawl, onlinePresence);

  // crawl güvenilir değilse ilgili kategorileri noData olarak işaretle
  if (crawlReliable === false) {
    seoFoundation.noData = true;
    citability.noData = true;
    if (!seoFoundation.details.includes("Bot koruması nedeniyle veri güvenilir değil")) {
      seoFoundation.details.push("Bot koruması nedeniyle veri güvenilir değil");
    }
    if (!citability.details.includes("Bot koruması nedeniyle veri güvenilir değil")) {
      citability.details.push("Bot koruması nedeniyle veri güvenilir değil");
    }
  }

  const categories = { seoFoundation, structuredData, citability, brandMention, llmVisibility };

  const overall = seoFoundation.score + structuredData.score + citability.score + brandMention.score + llmVisibility.score;
  const verdict = determineVerdict(overall);
  const color = determineColor(overall);
  const communityInsights = selectCommunityInsights(categories, overall);
  const actionPlan = buildActionPlan(verdict);

  return {
    overall,
    color,
    verdict,
    categories,
    communityInsights,
    actionPlan,
  };
}
