import type {
  CrawlResult,
  PageSpeedResult,
  SSLInfo,
  PageAnalysis,
  OnlinePresenceResult,
  SEOAuthorityReport,
  AuthoritySubScore,
} from "./types";

// ── Alt Skor Hesaplayıcılar ──

function scoreIntent(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Title var + 30-60 karakter → +5
  const titleLen = crawl.basicInfo.title?.length || 0;
  if (crawl.basicInfo.title && titleLen >= 30 && titleLen <= 60) {
    score += 5;
    details.push(`Title uygun uzunlukta (${titleLen} karakter)`);
  } else if (crawl.basicInfo.title) {
    score += 2;
    details.push(`Title var ama ${titleLen < 30 ? "kısa" : "uzun"} (${titleLen} karakter)`);
  } else {
    details.push("Title bulunamadı");
  }

  // Meta description var + 120-160 karakter → +5
  const descLen = crawl.basicInfo.metaDescription?.length || 0;
  if (crawl.basicInfo.metaDescription && descLen >= 120 && descLen <= 160) {
    score += 5;
    details.push(`Meta description uygun (${descLen} karakter)`);
  } else if (crawl.basicInfo.metaDescription) {
    score += 2;
    details.push(`Meta description var ama ${descLen < 120 ? "kısa" : "uzun"} (${descLen} karakter)`);
  } else {
    details.push("Meta description bulunamadı");
  }

  // Tek H1 var → +5
  if (crawl.headings.totalH1 === 1) {
    score += 5;
    details.push("Tek H1 etiketi mevcut");
  } else if (crawl.headings.totalH1 > 1) {
    score += 2;
    details.push(`Birden fazla H1 (${crawl.headings.totalH1} adet)`);
  } else {
    details.push("H1 etiketi bulunamadı");
  }

  // H2 yapısı var (≥2 adet) → +5
  if (crawl.headings.totalH2 >= 2) {
    score += 5;
    details.push(`H2 yapısı mevcut (${crawl.headings.totalH2} adet)`);
  } else if (crawl.headings.totalH2 === 1) {
    score += 2;
    details.push("Sadece 1 H2 — yapı zayıf");
  } else {
    details.push("H2 etiketi bulunamadı");
  }

  return {
    score,
    max: 20,
    label: "Intent Uyumu",
    details,
    noData: true, // Hedef kelime olmadan tam analiz yapılamaz
  };
}

function scoreTopicalAuthority(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // H2 ≥ 5 (pillar yapısı sinyali) → +5
  if (crawl.headings.totalH2 >= 5) {
    score += 5;
    details.push(`Güçlü H2 yapısı (${crawl.headings.totalH2} adet — pillar sinyali)`);
  } else if (crawl.headings.totalH2 >= 2) {
    score += 2;
    details.push(`H2 yapısı mevcut ama yetersiz (${crawl.headings.totalH2} adet)`);
  } else {
    details.push("H2 yapısı çok zayıf veya yok");
  }

  // Internal link ≥ 5 → +5
  if (crawl.links.totalInternal >= 5) {
    score += 5;
    details.push(`İç linkler yeterli (${crawl.links.totalInternal} adet)`);
  } else if (crawl.links.totalInternal >= 1) {
    score += 2;
    details.push(`İç link var ama az (${crawl.links.totalInternal} adet)`);
  } else {
    details.push("İç link bulunamadı");
  }

  // Kelime sayısı ≥ 2000 → +5
  if (crawl.content.wordCount >= 2000) {
    score += 5;
    details.push(`Zengin içerik (${crawl.content.wordCount} kelime)`);
  } else if (crawl.content.wordCount >= 500) {
    score += 2;
    details.push(`İçerik mevcut ama kısa (${crawl.content.wordCount} kelime)`);
  } else {
    details.push(`İçerik çok kısa (${crawl.content.wordCount} kelime)`);
  }

  // Schema.org var → +5
  if (crawl.technical.hasSchemaOrg) {
    score += 5;
    details.push(`Schema.org mevcut (${crawl.technical.schemaTypes.join(", ")})`);
  } else {
    details.push("Schema.org yapılandırılmamış");
  }

  return {
    score,
    max: 20,
    label: "Topikal Otorite",
    details,
    noData: true, // Tek sayfa taraması — cluster yapısı tespit edilemez
  };
}

function scoreTechnical(
  crawl: CrawlResult,
  pageSpeed: PageSpeedResult,
  ssl: SSLInfo
): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // robots.txt var → +3
  if (crawl.technical.hasRobotsTxt) {
    score += 3;
    details.push("robots.txt mevcut");
  } else {
    details.push("robots.txt bulunamadı");
  }

  // sitemap.xml var → +3
  if (crawl.technical.hasSitemap) {
    score += 3;
    details.push("sitemap.xml mevcut");
  } else {
    details.push("sitemap.xml bulunamadı");
  }

  // canonical var → +4
  if (crawl.metaSEO.canonical) {
    score += 4;
    details.push("Canonical URL tanımlı");
  } else {
    details.push("Canonical URL tanımlı değil");
  }

  // noindex yok → +5
  const hasNoindex = crawl.metaSEO.robots?.toLowerCase().includes("noindex") || false;
  if (!hasNoindex) {
    score += 5;
    details.push("noindex yok — indexlenebilir");
  } else {
    details.push("noindex var — arama motorları görmez!");
  }

  // CWV iyi (LCP ≤ 2.5s VEYA PageSpeed perf ≥ 75) → +5
  const lcpOk = pageSpeed.webVitals.lcp !== null && pageSpeed.webVitals.lcp <= 2500;
  const perfOk = pageSpeed.scores.performance !== null && pageSpeed.scores.performance >= 75;
  if (lcpOk || perfOk) {
    score += 5;
    details.push("Core Web Vitals iyi durumda");
  } else if (pageSpeed.scores.performance !== null) {
    details.push(`Performans düşük (${pageSpeed.scores.performance}/100)`);
  } else {
    details.push("Performans verisi alınamadı");
  }

  return {
    score,
    max: 20,
    label: "Teknik Altyapı",
    details,
  };
}

function scoreTrust(
  crawl: CrawlResult,
  ssl: SSLInfo,
  pageAnalysis: PageAnalysis
): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Dış link ≥ 1 → +5
  if (crawl.links.totalExternal >= 1) {
    score += 5;
    details.push(`Dış kaynak referansları mevcut (${crawl.links.totalExternal} adet)`);
  } else {
    details.push("Dış kaynak referansı yok");
  }

  // Privacy policy var → +5
  if (pageAnalysis.trustSignals.hasPrivacyPolicy) {
    score += 5;
    details.push("Gizlilik politikası mevcut");
  } else {
    details.push("Gizlilik politikası bulunamadı");
  }

  // Contact info var → +5
  if (pageAnalysis.trustSignals.hasContactInfo) {
    score += 5;
    details.push("İletişim bilgisi mevcut");
  } else {
    details.push("İletişim bilgisi bulunamadı");
  }

  // SSL geçerli → +5
  if (ssl.valid) {
    score += 5;
    details.push("SSL sertifikası geçerli");
  } else {
    details.push("SSL sertifikası geçersiz veya yok");
  }

  return {
    score,
    max: 20,
    label: "Güven Sinyalleri",
    details,
  };
}

function scoreBacklinkMention(onlinePresence?: OnlinePresenceResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];
  let noData = false;

  if (!onlinePresence) {
    noData = true;
    details.push("Dijital varlık verisi alınamadı");
    return { score: 0, max: 20, label: "Backlink & Referans", details, noData };
  }

  // Brand mentions ≥ 10 → +10 (1-9 arası → +5)
  const mentions = onlinePresence.googleIndex.brandMentions;
  if (onlinePresence.googleIndex.noData) {
    noData = true;
    details.push("Marka bahsetme verisi alınamadı (API key gerekli)");
  } else if (mentions >= 10) {
    score += 10;
    details.push(`Güçlü marka bilinirliği (${mentions} bahsetme)`);
  } else if (mentions >= 1) {
    score += 5;
    details.push(`Marka bahsetmeleri var ama az (${mentions} adet)`);
  } else {
    details.push("Marka bahsetmesi bulunamadı");
  }

  // Sosyal profil doğrulanmış ≥ 3 → +5
  const verified = onlinePresence.socialPresence.totalVerified;
  if (verified >= 3) {
    score += 5;
    details.push(`Sosyal medya doğrulanmış (${verified} profil)`);
  } else if (verified >= 1) {
    score += 2;
    details.push(`Sosyal medya az (${verified} profil doğrulandı)`);
  } else {
    details.push("Doğrulanmış sosyal profil yok");
  }

  // Wayback snapshot ≥ 10 → +5
  const snapshots = onlinePresence.waybackHistory.snapshotCount;
  if (snapshots >= 10) {
    score += 5;
    details.push(`Web arşiv geçmişi güçlü (${snapshots} snapshot)`);
  } else if (snapshots >= 1) {
    score += 2;
    details.push(`Web arşiv geçmişi var (${snapshots} snapshot)`);
  } else {
    details.push("Web arşivinde kayıt bulunamadı");
  }

  // Backlink profil verisi yok — her zaman noData
  if (!noData) {
    noData = true;
  }
  details.push("Backlink profil verisi yok (Ahrefs/Moz API gerekli)");

  return {
    score,
    max: 20,
    label: "Backlink & Referans",
    details,
    noData,
  };
}

// ── Verdict ──

function determineVerdict(overall: number): SEOAuthorityReport["verdict"] {
  if (overall >= 70) return "onay";
  if (overall >= 50) return "guclendir";
  return "yeniden-yapilandir";
}

function determineColor(overall: number): SEOAuthorityReport["color"] {
  if (overall >= 80) return "green";
  if (overall >= 70) return "lime";
  if (overall >= 50) return "yellow";
  if (overall >= 30) return "orange";
  return "red";
}

// ── Community Insights ──

function selectCommunityInsights(categories: SEOAuthorityReport["categories"], overall: number): string[] {
  const insights: string[] = [];

  if (categories.technical.score < 15) {
    insights.push("Reddit: Teknik denetim olmadan strateji kurmak kumar gibidir.");
  }
  if (categories.topicalAuthority.score < 10) {
    insights.push("Reddit: 1 pillar + 5 destek içerik olmadan topical authority sayılmaz.");
  }
  if (categories.intent.score < 10) {
    insights.push("Reddit: Top 5 sonucu analiz etmeden SEO teorisi çalışmaz.");
  }
  if (categories.trust.score < 10) {
    insights.push("Reddit: Dış kaynak referansı ve yazar bilgisi güven sinyalidir.");
  }
  if (categories.backlinkMention.score < 10) {
    insights.push("Reddit: Kalite > sayı. Rekabetli nişlerde backlink şart.");
  }
  if (overall >= 70) {
    insights.push("Reddit: SEO temel sağlamsa, content refresh ile büyüme hızlanır.");
  }

  // En az 1 insight olsun
  if (insights.length === 0) {
    insights.push("Reddit: Düzenli içerik güncellemesi (30-60 gün) sıralamalarda fark yaratır.");
  }

  return insights;
}

// ── Action Plan ──

function buildActionPlan(verdict: SEOAuthorityReport["verdict"]): string[] {
  switch (verdict) {
    case "yeniden-yapilandir":
      return [
        "Hafta 1-2: Teknik audit + kritik düzeltmeler (robots, sitemap, canonical)",
        "Hafta 3: İlk pillar içerik oluştur + iç link yapısını kur",
        "Hafta 4: Güven sinyalleri ekle (yazar bilgisi, dış kaynaklar) + rapor çıkar",
      ];
    case "guclendir":
      return [
        "Hafta 1: Eksik teknik öğeleri tamamla",
        "Hafta 2-3: 2 yeni içerik + 1 eski içerik refresh",
        "Hafta 4: 1 backlink çalışması + ilerleme raporu",
      ];
    case "onay":
      return [
        "Hafta 1-2: En iyi sayfaları content refresh (başlık, kaynak, tarih)",
        "Hafta 3: Yeni pillar içerik başlat",
        "Hafta 4: Backlink + dijital PR çalışması",
      ];
  }
}

// ── Ana Fonksiyon ──

export function generateSEOAuthorityReport(
  crawl: CrawlResult,
  pageSpeed: PageSpeedResult,
  ssl: SSLInfo,
  pageAnalysis: PageAnalysis,
  onlinePresence?: OnlinePresenceResult,
  crawlReliable?: boolean
): SEOAuthorityReport {
  const intent = scoreIntent(crawl);
  const topicalAuthority = scoreTopicalAuthority(crawl);
  const technical = scoreTechnical(crawl, pageSpeed, ssl);
  const trust = scoreTrust(crawl, ssl, pageAnalysis);
  const backlinkMention = scoreBacklinkMention(onlinePresence);

  // crawl güvenilir değilse intent ve topical noData olarak işaretle
  if (crawlReliable === false) {
    intent.noData = true;
    topicalAuthority.noData = true;
    if (!intent.details.includes("Bot koruması nedeniyle veri güvenilir değil")) {
      intent.details.push("Bot koruması nedeniyle veri güvenilir değil");
    }
    if (!topicalAuthority.details.includes("Bot koruması nedeniyle veri güvenilir değil")) {
      topicalAuthority.details.push("Bot koruması nedeniyle veri güvenilir değil");
    }
  }

  const categories = { intent, topicalAuthority, technical, trust, backlinkMention };

  const overall = intent.score + topicalAuthority.score + technical.score + trust.score + backlinkMention.score;
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
