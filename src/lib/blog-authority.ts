import type {
  CrawlResult,
  PageAnalysis,
  OnlinePresenceResult,
  WebsiteDNA,
  BlogAuthorityReport,
  AuthoritySubScore,
} from "./types";

// ── Alt Skor Hesaplayıcılar ──

function scoreContentDepth(crawl: CrawlResult, dna?: WebsiteDNA): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Sitemap sayfa sayısı (blog yazı sayısı tahmini)
  const pageCount = crawl.technical.sitemapPageCount;
  if (pageCount && pageCount >= 20) {
    score += 12;
    details.push(`Zengin içerik arşivi (sitemap'te ${pageCount} sayfa)`);
  } else if (pageCount && pageCount >= 12) {
    score += 8;
    details.push(`İyi içerik arşivi (sitemap'te ${pageCount} sayfa)`);
  } else if (pageCount && pageCount >= 8) {
    score += 5;
    details.push(`Orta içerik arşivi (sitemap'te ${pageCount} sayfa)`);
  } else if (pageCount && pageCount >= 1) {
    score += 2;
    details.push(`Az içerik (sitemap'te ${pageCount} sayfa)`);
  } else {
    details.push("Sitemap sayfa sayısı bilinmiyor");
  }

  // Kelime sayısı (mevcut sayfa derinliği)
  if (crawl.content.wordCount >= 2000) {
    score += 8;
    details.push(`Derin içerik (${crawl.content.wordCount} kelime — pillar seviyesi)`);
  } else if (crawl.content.wordCount >= 1200) {
    score += 5;
    details.push(`Orta uzunlukta içerik (${crawl.content.wordCount} kelime)`);
  } else if (crawl.content.wordCount >= 600) {
    score += 3;
    details.push(`Kısa içerik (${crawl.content.wordCount} kelime)`);
  } else {
    score += 1;
    details.push(`Çok kısa içerik (${crawl.content.wordCount} kelime)`);
  }

  // Blog varlığı (DNA'dan)
  if (dna?.contentStructure.hasBlog) {
    score += 5;
    details.push("Blog bölümü mevcut");
  } else {
    details.push("Blog bölümü tespit edilemedi");
  }

  // H2 yapısı (içerik bölümleme derinliği)
  if (crawl.headings.totalH2 >= 5) {
    score += 5;
    details.push(`Güçlü bölümleme (${crawl.headings.totalH2} H2 başlık)`);
  } else if (crawl.headings.totalH2 >= 3) {
    score += 3;
    details.push(`Bölümleme var (${crawl.headings.totalH2} H2)`);
  } else {
    details.push("H2 bölümleme yetersiz");
  }

  score = Math.min(score, 30);

  return {
    score,
    max: 30,
    label: "İçerik Derinliği",
    details,
    noData: true, // Tek sayfa taraması — tüm blog arşivi analiz edilemez
  };
}

function scorePillarCluster(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // İç link sayısı (cluster yapısı sinyali)
  if (crawl.links.totalInternal >= 10) {
    score += 8;
    details.push(`Güçlü iç link ağı (${crawl.links.totalInternal} link) — cluster sinyali`);
  } else if (crawl.links.totalInternal >= 5) {
    score += 5;
    details.push(`İç link ağı mevcut (${crawl.links.totalInternal} link)`);
  } else if (crawl.links.totalInternal >= 1) {
    score += 2;
    details.push(`Az iç link (${crawl.links.totalInternal} link)`);
  } else {
    details.push("İç link yok — cluster yapısı kurulamaz");
  }

  // H2 derinliği (pillar yapısı sinyali — 5+ H2 = pillar)
  if (crawl.headings.totalH2 >= 7) {
    score += 7;
    details.push(`Pillar düzeyinde yapı (${crawl.headings.totalH2} alt bölüm)`);
  } else if (crawl.headings.totalH2 >= 4) {
    score += 4;
    details.push(`Orta düzey yapı (${crawl.headings.totalH2} alt bölüm)`);
  } else if (crawl.headings.totalH2 >= 2) {
    score += 2;
    details.push(`Basit yapı (${crawl.headings.totalH2} alt bölüm)`);
  } else {
    details.push("Alt bölüm yapısı yok");
  }

  // H3 yapısı (derinlik sinyali)
  if (crawl.headings.totalH3 >= 3) {
    score += 5;
    details.push(`H3 derinliği var (${crawl.headings.totalH3} alt başlık) — detaylı içerik`);
  } else if (crawl.headings.totalH3 >= 1) {
    score += 2;
    details.push(`Az H3 (${crawl.headings.totalH3} adet)`);
  }

  score = Math.min(score, 20);

  return {
    score,
    max: 20,
    label: "Pillar & Cluster",
    details,
    noData: true, // Tek sayfa — tüm cluster yapısı tespit edilemez
  };
}

function scoreOriginality(crawl: CrawlResult, rawHtml: string): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];
  const htmlLower = rawHtml.toLowerCase();

  // Paragraf zenginliği (özgün içerik sinyali)
  if (crawl.content.paragraphCount >= 10) {
    score += 5;
    details.push(`Zengin paragraf yapısı (${crawl.content.paragraphCount} paragraf)`);
  } else if (crawl.content.paragraphCount >= 5) {
    score += 3;
    details.push(`Paragraf yapısı mevcut (${crawl.content.paragraphCount} paragraf)`);
  } else {
    score += 1;
    details.push("Paragraf yapısı zayıf");
  }

  // Görsel varlığı (deneyim/kanıt sinyali — screenshot, örnek)
  if (crawl.images.total >= 3) {
    score += 5;
    details.push(`Görsel içerik mevcut (${crawl.images.total} görsel)`);
  } else if (crawl.images.total >= 1) {
    score += 2;
    details.push(`Az görsel (${crawl.images.total} adet)`);
  } else {
    details.push("Görsel içerik yok — deneyim kanıtı zayıf");
  }

  // Yazar bilgisi sinyali (author, bio gibi yapılar)
  const hasAuthor = htmlLower.includes("author") || htmlLower.includes("yazar") ||
    crawl.technical.schemaTypes.some((t) => /person|author/i.test(t));
  if (hasAuthor) {
    score += 5;
    details.push("Yazar bilgisi sinyali tespit edildi (E-E-A-T)");
  } else {
    details.push("Yazar bilgisi bulunamadı — E-E-A-T zayıf");
  }

  score = Math.min(score, 15);

  return {
    score,
    max: 15,
    label: "Özgünlük & Deneyim",
    details,
    noData: true, // Case study ve kişisel deneyim doğrudan tespit edilemez
  };
}

function scoreAssetProduction(crawl: CrawlResult, rawHtml: string): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];
  const htmlLower = rawHtml.toLowerCase();

  // PDF/download/template linkleri
  const hasPdf = htmlLower.includes(".pdf") || htmlLower.includes("download") || htmlLower.includes("indir");
  const hasTemplate = htmlLower.includes("template") || htmlLower.includes("şablon") || htmlLower.includes("sablon") || htmlLower.includes("checklist");
  const hasTool = htmlLower.includes("calculator") || htmlLower.includes("hesaplayıcı") || htmlLower.includes("hesapla") || htmlLower.includes("tool");

  if (hasPdf) {
    score += 5;
    details.push("PDF/indirilebilir içerik sinyali tespit edildi");
  }
  if (hasTemplate) {
    score += 5;
    details.push("Şablon/checklist sinyali tespit edildi");
  }
  if (hasTool) {
    score += 5;
    details.push("Mini araç/hesaplayıcı sinyali tespit edildi");
  }

  if (!hasPdf && !hasTemplate && !hasTool) {
    details.push("İndirilebilir asset (PDF, şablon, araç) bulunamadı");
  }

  score = Math.min(score, 15);

  return {
    score,
    max: 15,
    label: "Asset Üretimi",
    details,
    noData: true, // HTML pattern'lerle dolaylı tespit
  };
}

function scoreTrustSignals(crawl: CrawlResult, pageAnalysis: PageAnalysis): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Dış kaynak linkleri
  if (crawl.links.totalExternal >= 2) {
    score += 4;
    details.push(`Dış kaynak referansları var (${crawl.links.totalExternal} link)`);
  } else if (crawl.links.totalExternal >= 1) {
    score += 2;
    details.push(`Tek dış kaynak (${crawl.links.totalExternal} link)`);
  } else {
    details.push("Dış kaynak referansı yok");
  }

  // Görsel alt text (erişilebilirlik + güven)
  const altRatio = crawl.images.total > 0
    ? (crawl.images.total - crawl.images.totalMissingAlt) / crawl.images.total
    : 0;
  if (crawl.images.total > 0 && altRatio >= 0.8) {
    score += 3;
    details.push(`Görsel alt text'leri iyi (%${(altRatio * 100).toFixed(0)})`);
  } else if (crawl.images.total > 0 && altRatio >= 0.5) {
    score += 1;
    details.push(`Alt text'ler kısmen mevcut (%${(altRatio * 100).toFixed(0)})`);
  } else if (crawl.images.total > 0) {
    details.push("Alt text'ler eksik");
  }

  // İletişim/güven bilgisi
  if (pageAnalysis.trustSignals.hasContactInfo || pageAnalysis.trustSignals.hasEmail) {
    score += 3;
    details.push("İletişim bilgisi mevcut — güvenilirlik sinyali");
  } else {
    details.push("İletişim bilgisi bulunamadı");
  }

  score = Math.min(score, 10);

  return {
    score,
    max: 10,
    label: "Güven Sinyalleri",
    details,
  };
}

function scoreDistributionSignal(
  pageAnalysis: PageAnalysis,
  onlinePresence?: OnlinePresenceResult,
  dna?: WebsiteDNA
): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Sosyal medya profilleri (dağıtım kanalları)
  const socialCount = pageAnalysis.socialLinks.length;
  const verifiedCount = onlinePresence?.socialPresence.totalVerified || 0;
  if (verifiedCount >= 3) {
    score += 4;
    details.push(`Güçlü sosyal medya varlığı (${verifiedCount} doğrulanmış profil)`);
  } else if (verifiedCount >= 1 || socialCount >= 1) {
    score += 2;
    details.push(`Sosyal medya mevcut (${verifiedCount || socialCount} profil)`);
  } else {
    details.push("Sosyal medya profili bulunamadı — dağıtım kanalı yok");
  }

  // Newsletter sinyali
  if (dna?.contentStructure.hasNewsletter) {
    score += 3;
    details.push("Newsletter/email listesi tespit edildi");
  } else if (pageAnalysis.cta.hasContactForm) {
    score += 1;
    details.push("İletişim formu var ama newsletter tespit edilemedi");
  } else {
    details.push("Newsletter/email listesi bulunamadı");
  }

  // Paylaşım butonları / sosyal widget (dolaylı dağıtım sinyali)
  if (socialCount >= 2 && verifiedCount >= 2) {
    score += 3;
    details.push("Birden fazla aktif dağıtım kanalı — organik erişim potansiyeli");
  }

  score = Math.min(score, 10);

  return {
    score,
    max: 10,
    label: "Dağıtım Sinyali",
    details,
    noData: true, // Reddit/Pinterest/YouTube paylaşımları doğrudan tespit edilemez
  };
}

// ── Verdict ──

function determineVerdict(overall: number): BlogAuthorityReport["verdict"] {
  if (overall >= 70) return "onay";
  if (overall >= 50) return "guclendir";
  return "yeniden-yapilandir";
}

function determineColor(overall: number): BlogAuthorityReport["color"] {
  if (overall >= 80) return "green";
  if (overall >= 70) return "lime";
  if (overall >= 50) return "yellow";
  if (overall >= 30) return "orange";
  return "red";
}

// ── Community Insights (Reddit kılavuzundan) ──

function selectCommunityInsights(categories: BlogAuthorityReport["categories"], overall: number): string[] {
  const insights: string[] = [];

  if (categories.contentDepth.score < 15) {
    insights.push("Reddit: 8+ yazı olmadan blog otoritesi kurulamaz. Haftada 1 ana + 1 kısa içerik hedefle.");
  }
  if (categories.pillarCluster.score < 10) {
    insights.push("Reddit: 1 pillar + 5 destek içerik olmadan topical authority sayılmaz.");
  }
  if (categories.originality.score < 8) {
    insights.push("Reddit: AI kokusu bırakan yazılar sıralamada düşüyor. İnsan sesi + deneyim ekle.");
  }
  if (categories.assetProduction.score < 8) {
    insights.push("Reddit: PDF checklist veya şablon eklemeyen yazılar kaydedilmiyor ve paylaşılmıyor.");
  }
  if (categories.trustSignals.score < 5) {
    insights.push("Reddit: Dış kaynak referansı ve yazar bilgisi güven sinyalidir — E-E-A-T kritik.");
  }
  if (categories.distributionSignal.score < 5) {
    insights.push("Reddit: Sadece yayınlamak yetmez. Reddit'te yardım et, Pinterest'e pin at, email ile duyur.");
  }
  if (overall >= 70) {
    insights.push("Reddit: Blog temeli sağlam. Şimdi content refresh (30-60 gün) ile sıralamaları koru.");
  }

  if (insights.length === 0) {
    insights.push("Reddit: Düzenli içerik üretimi + dağıtım = blog büyümesinin tek formülü.");
  }

  return insights;
}

// ── Action Plan (kılavuzdan) ──

function buildActionPlan(verdict: BlogAuthorityReport["verdict"]): string[] {
  switch (verdict) {
    case "yeniden-yapilandir":
      return [
        "Hafta 1: Nişi netleştir + 1 pillar başlığı seç + 10 destek konu çıkar + 2 yazı yaz",
        "Hafta 2: 2 yazı daha + 1 eski yazıyı optimize et + Pinterest görselleri hazırla",
        "Hafta 3: 2 yazı + 1 kısa video özet + email listesine duyuru + 1 case study",
        "Hafta 4: 2 yazı + iç linkleri güncelle + 30 gün raporu çıkar + en iyi yazıyı güçlendir",
      ];
    case "guclendir":
      return [
        "Hafta 1: Pillar içeriği güncelle + eksik H2/H3 yapısını tamamla",
        "Hafta 2-3: 3 yeni destek yazısı + her birine asset (PDF/checklist) ekle",
        "Hafta 4: Dağıtım kanallarını aktifleştir + content refresh raporu",
      ];
    case "onay":
      return [
        "Hafta 1-2: En iyi yazıları content refresh (başlık, görsel, kaynak güncelle)",
        "Hafta 3: Yeni pillar konusu başlat + case study yayınla",
        "Hafta 4: Dağıtım stratejisini genişlet (video + email + sosyal medya)",
      ];
  }
}

// ── Ana Fonksiyon ──

export function generateBlogAuthorityReport(
  crawl: CrawlResult,
  rawHtml: string,
  pageAnalysis: PageAnalysis,
  onlinePresence?: OnlinePresenceResult,
  dna?: WebsiteDNA,
  crawlReliable?: boolean
): BlogAuthorityReport {
  const contentDepth = scoreContentDepth(crawl, dna);
  const pillarCluster = scorePillarCluster(crawl);
  const originality = scoreOriginality(crawl, rawHtml);
  const assetProduction = scoreAssetProduction(crawl, rawHtml);
  const trustSignals = scoreTrustSignals(crawl, pageAnalysis);
  const distributionSignal = scoreDistributionSignal(pageAnalysis, onlinePresence, dna);

  // crawl güvenilir değilse ilgili kategorileri noData olarak işaretle
  if (crawlReliable === false) {
    contentDepth.noData = true;
    originality.noData = true;
    assetProduction.noData = true;
    const msg = "Bot koruması nedeniyle veri güvenilir değil";
    if (!contentDepth.details.includes(msg)) contentDepth.details.push(msg);
    if (!originality.details.includes(msg)) originality.details.push(msg);
    if (!assetProduction.details.includes(msg)) assetProduction.details.push(msg);
  }

  const categories = { contentDepth, pillarCluster, originality, assetProduction, trustSignals, distributionSignal };

  const overall = contentDepth.score + pillarCluster.score + originality.score +
    assetProduction.score + trustSignals.score + distributionSignal.score;
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
