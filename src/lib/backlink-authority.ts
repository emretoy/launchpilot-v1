import type {
  CrawlResult,
  PageAnalysis,
  OnlinePresenceResult,
  BacklinkAuthorityReport,
  AuthoritySubScore,
} from "./types";

// ── Alt Skor Hesaplayıcılar ──

function scoreRelevance(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Dış linkler niş ile alakalı mı? (dolaylı sinyal: dış link sayısı + çeşitliliği)
  // Doğrudan backlink profili yok — dış linklerin varlığı "relevance farkındalığı" sinyali
  if (crawl.links.totalExternal >= 5) {
    score += 10;
    details.push(`Dış kaynak referansları güçlü (${crawl.links.totalExternal} link) — niş farkındalığı sinyali`);
  } else if (crawl.links.totalExternal >= 2) {
    score += 5;
    details.push(`Dış kaynak referansları mevcut (${crawl.links.totalExternal} link)`);
  } else if (crawl.links.totalExternal >= 1) {
    score += 2;
    details.push(`Tek dış kaynak referansı (${crawl.links.totalExternal} link)`);
  } else {
    details.push("Dış kaynak referansı yok — alaka sinyali üretilemiyor");
  }

  // Schema.org türleri (niş sinyali — konu odağını gösterir)
  if (crawl.technical.hasSchemaOrg && crawl.technical.schemaTypes.length >= 2) {
    score += 8;
    details.push(`Zengin schema türleri (${crawl.technical.schemaTypes.join(", ")}) — konu odağı belirgin`);
  } else if (crawl.technical.hasSchemaOrg) {
    score += 4;
    details.push("Schema.org mevcut ama türler sınırlı");
  } else {
    details.push("Schema.org yok — arama motorları konuyu tanıyamaz");
  }

  // İç link yapısı (topical cluster sinyali) → max +7
  if (crawl.links.totalInternal >= 10) {
    score += 7;
    details.push(`Güçlü iç link yapısı (${crawl.links.totalInternal} link) — topikal yapı sinyali`);
  } else if (crawl.links.totalInternal >= 5) {
    score += 4;
    details.push(`İç link yapısı mevcut (${crawl.links.totalInternal} link)`);
  } else if (crawl.links.totalInternal >= 1) {
    score += 2;
    details.push(`İç link az (${crawl.links.totalInternal} link)`);
  } else {
    details.push("İç link yok — topikal yapı sinyali üretilemiyor");
  }

  // H2 yapısı (konu derinliği sinyali) → max +5
  if (crawl.headings.totalH2 >= 5) {
    score += 5;
    details.push(`Derin içerik yapısı (${crawl.headings.totalH2} H2) — konu otoritesi sinyali`);
  } else if (crawl.headings.totalH2 >= 2) {
    score += 2;
    details.push(`H2 yapısı var (${crawl.headings.totalH2} adet)`);
  }

  // Backlink profil verisi yok uyarısı
  details.push("Backlink profil verisi yok (Ahrefs/Moz API gerekli) — dolaylı sinyallerle skorlandı");

  return {
    score,
    max: 30,
    label: "Alaka Düzeyi",
    details,
    noData: true,
  };
}

function scoreTrafficSignal(crawl: CrawlResult, onlinePresence?: OnlinePresenceResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];
  let noData = false;

  // Google indexlenme (trafik sinyali)
  if (onlinePresence?.googleIndex) {
    if (onlinePresence.googleIndex.noData) {
      noData = true;
      details.push("Google index verisi alınamadı (API key gerekli)");
    } else if (onlinePresence.googleIndex.isIndexed) {
      score += 7;
      details.push(`Google'da indexli (${onlinePresence.googleIndex.indexedPageCount} sayfa)`);
      if (onlinePresence.googleIndex.indexedPageCount >= 50) {
        score += 3;
        details.push("Yüksek sayfa indexi — trafik potansiyeli güçlü");
      }
    } else {
      details.push("Google'da indexlenmemiş — trafik sinyali yok");
    }
  } else {
    noData = true;
    details.push("Online presence verisi yok");
  }

  // Sitemap sayfa sayısı (büyük site = potansiyel trafik)
  if (crawl.technical.hasSitemap && crawl.technical.sitemapPageCount) {
    if (crawl.technical.sitemapPageCount >= 50) {
      score += 5;
      details.push(`Büyük sitemap (${crawl.technical.sitemapPageCount} sayfa)`);
    } else if (crawl.technical.sitemapPageCount >= 10) {
      score += 3;
      details.push(`Orta sitemap (${crawl.technical.sitemapPageCount} sayfa)`);
    } else {
      score += 1;
      details.push(`Küçük sitemap (${crawl.technical.sitemapPageCount} sayfa)`);
    }
  } else if (crawl.technical.hasSitemap) {
    score += 2;
    details.push("Sitemap mevcut (sayfa sayısı bilinmiyor)");
  } else {
    details.push("Sitemap yok — sayfa keşfi zorlaşır");
  }

  // Rich snippet (trafik çekme potansiyeli)
  if (onlinePresence?.googleIndex.hasRichSnippet) {
    score += 5;
    details.push("Rich snippet mevcut — yüksek CTR potansiyeli");
  }

  score = Math.min(score, 20);

  return {
    score,
    max: 20,
    label: "Trafik Sinyali",
    details,
    noData,
  };
}

function scoreLinkDiversity(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Farklı dış domain'lere link (çeşitlilik sinyali)
  const externalDomains = new Set<string>();
  for (const link of crawl.links.external) {
    try {
      const domain = new URL(link.href).hostname;
      externalDomains.add(domain);
    } catch {
      // geçersiz URL — atla
    }
  }

  if (externalDomains.size >= 5) {
    score += 8;
    details.push(`${externalDomains.size} farklı dış domain'e link — çeşitlilik iyi`);
  } else if (externalDomains.size >= 2) {
    score += 4;
    details.push(`${externalDomains.size} farklı dış domain'e link`);
  } else if (externalDomains.size === 1) {
    score += 1;
    details.push("Tek dış domain'e link — çeşitlilik yok");
  } else {
    details.push("Dış link yok — link çeşitliliği ölçülemiyor");
  }

  // İç linkler farklı path'lere mi gidiyor?
  const internalPaths = new Set<string>();
  for (const link of crawl.links.internal) {
    try {
      const path = new URL(link.href, "https://example.com").pathname;
      internalPaths.add(path);
    } catch {
      // geçersiz URL — atla
    }
  }

  if (internalPaths.size >= 10) {
    score += 7;
    details.push(`${internalPaths.size} farklı iç sayfa linklenmiş — site yapısı güçlü`);
  } else if (internalPaths.size >= 5) {
    score += 4;
    details.push(`${internalPaths.size} farklı iç sayfa linklenmiş`);
  } else if (internalPaths.size >= 1) {
    score += 2;
    details.push(`${internalPaths.size} farklı iç sayfa`);
  } else {
    details.push("İç link yapısı yok");
  }

  // Kırık link kontrolü (link profili kalitesi)
  if (crawl.links.totalBroken === 0) {
    score += 5;
    details.push("Kırık link yok — link profili temiz");
  } else if (crawl.links.totalBroken <= 2) {
    score += 2;
    details.push(`${crawl.links.totalBroken} kırık link — düzeltilmeli`);
  } else {
    details.push(`${crawl.links.totalBroken} kırık link — link profili bozuk`);
  }

  score = Math.min(score, 20);

  return {
    score,
    max: 20,
    label: "Link Çeşitliliği",
    details,
    noData: true, // Gelen backlink profili yok
  };
}

function scoreAnchorNaturalness(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Dış link anchor text'leri analizi (sitenin verdiği linklerin doğallığı)
  const anchors = crawl.links.external.map((l) => l.text.trim()).filter(Boolean);
  const uniqueAnchors = new Set(anchors);

  if (anchors.length === 0) {
    details.push("Dış link yok — anchor analizi yapılamadı");
    details.push("Gelen backlink anchor verisi yok (Ahrefs/Moz API gerekli)");
    return { score: 0, max: 10, label: "Anchor Doğallığı", details, noData: true };
  }

  // Çeşitlilik oranı
  const diversityRatio = uniqueAnchors.size / anchors.length;
  if (diversityRatio >= 0.7) {
    score += 5;
    details.push(`Anchor text çeşitliliği iyi (%${(diversityRatio * 100).toFixed(0)} benzersiz)`);
  } else if (diversityRatio >= 0.4) {
    score += 3;
    details.push(`Anchor text çeşitliliği orta (%${(diversityRatio * 100).toFixed(0)} benzersiz)`);
  } else {
    score += 1;
    details.push(`Anchor text tekrarı yüksek (%${(diversityRatio * 100).toFixed(0)} benzersiz)`);
  }

  // "buraya tıklayın" / "click here" gibi boş anchor'lar
  const genericAnchors = anchors.filter((a) =>
    /^(click here|buraya|tıklayın|here|link|read more|devamı)$/i.test(a)
  );
  if (genericAnchors.length === 0) {
    score += 5;
    details.push("Genel (generic) anchor kullanımı yok — doğal");
  } else {
    score += 2;
    details.push(`${genericAnchors.length} genel anchor ("click here" vb.) — iyileştirilebilir`);
  }

  // Gelen backlink anchor verisi yok uyarısı
  details.push("Gelen backlink anchor verisi yok (Ahrefs/Moz API gerekli)");

  score = Math.min(score, 10);

  return {
    score,
    max: 10,
    label: "Anchor Doğallığı",
    details,
    noData: true,
  };
}

function scoreMentionSignal(onlinePresence?: OnlinePresenceResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];
  let noData = false;

  if (!onlinePresence) {
    noData = true;
    details.push("Dijital varlık verisi alınamadı");
    return { score: 0, max: 20, label: "Bahsetme Sinyali", details, noData };
  }

  // Brand mentions → +8
  const mentions = onlinePresence.googleIndex.brandMentions;
  if (onlinePresence.googleIndex.noData) {
    noData = true;
    details.push("Marka bahsetme verisi alınamadı (API key gerekli)");
  } else if (mentions >= 10) {
    score += 8;
    details.push(`Güçlü marka bilinirliği (${mentions} bahsetme)`);
  } else if (mentions >= 3) {
    score += 5;
    details.push(`Marka bahsetmeleri var (${mentions} adet)`);
  } else if (mentions >= 1) {
    score += 2;
    details.push(`Az marka bahsetmesi (${mentions} adet)`);
  } else {
    details.push("Marka bahsetmesi bulunamadı");
  }

  // Sosyal profiller (mention kaynağı) → +6
  const verified = onlinePresence.socialPresence.totalVerified;
  if (verified >= 4) {
    score += 6;
    details.push(`Güçlü sosyal medya varlığı (${verified} doğrulanmış profil)`);
  } else if (verified >= 2) {
    score += 3;
    details.push(`Sosyal medya mevcut (${verified} profil)`);
  } else if (verified >= 1) {
    score += 1;
    details.push(`Tek sosyal profil (${verified} adet)`);
  } else {
    details.push("Doğrulanmış sosyal profil yok");
  }

  // Wayback geçmişi (tarihsel varlık) → +6
  const snapshots = onlinePresence.waybackHistory.snapshotCount;
  const years = onlinePresence.waybackHistory.websiteAge;
  if (snapshots >= 20 && years && years >= 3) {
    score += 6;
    details.push(`Köklü web varlığı (${years} yıl, ${snapshots} arşiv)`);
  } else if (snapshots >= 5) {
    score += 3;
    details.push(`Web arşiv geçmişi var (${snapshots} snapshot)`);
  } else if (snapshots >= 1) {
    score += 1;
    details.push(`Az arşiv geçmişi (${snapshots} snapshot)`);
  } else {
    details.push("Web arşivinde kayıt yok");
  }

  return {
    score,
    max: 20,
    label: "Bahsetme Sinyali",
    details,
    noData,
  };
}

// ── Verdict ──

function determineVerdict(overall: number): BacklinkAuthorityReport["verdict"] {
  if (overall >= 70) return "onay";
  if (overall >= 50) return "guclendir";
  return "yeniden-yapilandir";
}

function determineColor(overall: number): BacklinkAuthorityReport["color"] {
  if (overall >= 80) return "green";
  if (overall >= 70) return "lime";
  if (overall >= 50) return "yellow";
  if (overall >= 30) return "orange";
  return "red";
}

// ── Community Insights (Reddit kılavuzundan) ──

function selectCommunityInsights(categories: BacklinkAuthorityReport["categories"], overall: number): string[] {
  const insights: string[] = [];

  if (categories.relevance.score < 15) {
    insights.push("Reddit: DA/DR kovalamak anlamsız. Relevance > DA/DR — aynı nişteki sitelerden link al.");
  }
  if (categories.trafficSignal.score < 10) {
    insights.push("Reddit: Trafik alan sayfadan link almak kritik. Ölü sitelerden link değersiz.");
  }
  if (categories.linkDiversity.score < 10) {
    insights.push("Reddit: Kalite > sayı. Rekabetçi nişlerde backlink şart ama çeşitlilik de önemli.");
  }
  if (categories.anchorNaturalness.score < 5) {
    insights.push("Reddit: Anchor text doğallığı Google'ın en çok baktığı backlink sinyallerinden biri.");
  }
  if (categories.mentionSignal.score < 10) {
    insights.push("Reddit: Digital PR en güçlü link kaynağı. Linkable asset (araştırma, veri, grafik) oluştur.");
  }
  if (overall >= 70) {
    insights.push("Reddit: Backlink temeli sağlam. Şimdi competitor backlink gap analizi ile büyümeye geç.");
  }

  if (insights.length === 0) {
    insights.push("Reddit: Çoğu kaliteli link ücretli outreach ile gelir. Guest post + dijital PR en etkili yol.");
  }

  return insights;
}

// ── Action Plan (kılavuzdan) ──

function buildActionPlan(verdict: BacklinkAuthorityReport["verdict"]): string[] {
  switch (verdict) {
    case "yeniden-yapilandir":
      return [
        "Hafta 1: Rakip backlink analizi yap + linkable asset (araştırma, veri, infografik) hazırla",
        "Hafta 2: 10 outreach email gönder + 2-3 guest post görüşmesi başlat",
        "Hafta 3: 2 dijital PR pitch + 1 resource page link çalışması",
        "Hafta 4: Backlink raporu çıkar + en iyi linki güçlendir",
      ];
    case "guclendir":
      return [
        "Hafta 1: Competitor backlink gap analizi + eksik niş siteleri listele",
        "Hafta 2-3: 5 hedefli outreach + 1 linkable asset yayınla",
        "Hafta 4: Link profili raporu + anchor text çeşitliliği kontrolü",
      ];
    case "onay":
      return [
        "Hafta 1-2: Mevcut en güçlü linkleri koruma + broken link kontrolü",
        "Hafta 3: Yeni dijital PR stratejisi başlat (veri odaklı içerik)",
        "Hafta 4: Link exchange temizliği + ilerleme raporu",
      ];
  }
}

// ── Ana Fonksiyon ──

export function generateBacklinkAuthorityReport(
  crawl: CrawlResult,
  pageAnalysis: PageAnalysis,
  onlinePresence?: OnlinePresenceResult,
  crawlReliable?: boolean
): BacklinkAuthorityReport {
  const relevance = scoreRelevance(crawl);
  const trafficSignal = scoreTrafficSignal(crawl, onlinePresence);
  const linkDiversity = scoreLinkDiversity(crawl);
  const anchorNaturalness = scoreAnchorNaturalness(crawl);
  const mentionSignal = scoreMentionSignal(onlinePresence);

  // crawl güvenilir değilse ilgili kategorileri noData olarak işaretle
  if (crawlReliable === false) {
    relevance.noData = true;
    linkDiversity.noData = true;
    anchorNaturalness.noData = true;
    const msg = "Bot koruması nedeniyle veri güvenilir değil";
    if (!relevance.details.includes(msg)) relevance.details.push(msg);
    if (!linkDiversity.details.includes(msg)) linkDiversity.details.push(msg);
    if (!anchorNaturalness.details.includes(msg)) anchorNaturalness.details.push(msg);
  }

  const categories = { relevance, trafficSignal, linkDiversity, anchorNaturalness, mentionSignal };

  const overall = relevance.score + trafficSignal.score + linkDiversity.score + anchorNaturalness.score + mentionSignal.score;
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
