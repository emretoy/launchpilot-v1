import type {
  CrawlResult,
  PageAnalysis,
  OnlinePresenceResult,
  AEOAuthorityReport,
  AuthoritySubScore,
} from "./types";

// ── Alt Skor Hesaplayıcılar ──

function scoreAnswerBlocks(crawl: CrawlResult, rawHtml: string): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Paragraf sayısı ≥ 3 (cevap blokları) → +5
  if (crawl.content.paragraphCount >= 5) {
    score += 5;
    details.push(`İyi paragraf yapısı (${crawl.content.paragraphCount} paragraf)`);
  } else if (crawl.content.paragraphCount >= 3) {
    score += 3;
    details.push(`Paragraf yapısı mevcut (${crawl.content.paragraphCount} paragraf)`);
  } else {
    details.push("Paragraf yapısı zayıf — cevap blokları oluşturulamaz");
  }

  // İçerik uzunluğu ≥ 500 kelime → +5
  if (crawl.content.wordCount >= 1000) {
    score += 5;
    details.push(`Zengin içerik (${crawl.content.wordCount} kelime)`);
  } else if (crawl.content.wordCount >= 500) {
    score += 3;
    details.push(`Orta seviye içerik (${crawl.content.wordCount} kelime)`);
  } else {
    details.push(`İçerik kısa (${crawl.content.wordCount} kelime) — cevap için yetersiz`);
  }

  // H2 altı yapı (her H2 bir cevap bloğu olabilir) → +5
  if (crawl.headings.totalH2 >= 4) {
    score += 5;
    details.push(`Güçlü bölümleme (${crawl.headings.totalH2} H2 başlık)`);
  } else if (crawl.headings.totalH2 >= 2) {
    score += 3;
    details.push(`Bölümleme mevcut (${crawl.headings.totalH2} H2)`);
  } else {
    details.push("H2 bölümleme yok — her soru için ayrı bölüm gerekir");
  }

  // Liste veya özet yapısı (ul/ol/summary) → +5
  const htmlLower = rawHtml.toLowerCase();
  const hasLists = (htmlLower.match(/<(ul|ol)[^>]*>/g) || []).length;
  const hasSummary = htmlLower.includes("<summary");
  if (hasLists >= 3 || hasSummary) {
    score += 5;
    details.push(`Liste/özet yapısı mevcut (${hasLists} liste${hasSummary ? " + summary" : ""})`);
  } else if (hasLists >= 1) {
    score += 2;
    details.push(`Az liste yapısı (${hasLists} adet)`);
  } else {
    details.push("Liste veya özet yapısı bulunamadı");
  }

  return {
    score,
    max: 20,
    label: "Cevap Blokları",
    details,
  };
}

function scoreFAQHowToSchema(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  const types = crawl.technical.schemaTypes.map((t) => t.toLowerCase());

  // FAQ schema → +7
  if (types.some((t) => t.includes("faq"))) {
    score += 7;
    details.push("FAQPage schema mevcut");
  } else {
    details.push("FAQPage schema bulunamadı");
  }

  // HowTo schema → +7
  if (types.some((t) => t.includes("howto"))) {
    score += 7;
    details.push("HowTo schema mevcut");
  } else {
    details.push("HowTo schema bulunamadı");
  }

  // Article veya diğer zengin schema → +6
  const hasArticle = types.some((t) => t.includes("article") || t.includes("newsarticle") || t.includes("blogposting"));
  const hasBreadcrumb = types.some((t) => t.includes("breadcrumb"));
  if (hasArticle && hasBreadcrumb) {
    score += 6;
    details.push("Article + BreadcrumbList schema mevcut");
  } else if (hasArticle) {
    score += 4;
    details.push("Article schema mevcut");
  } else if (hasBreadcrumb) {
    score += 2;
    details.push("BreadcrumbList schema mevcut");
  } else if (crawl.technical.hasSchemaOrg) {
    score += 1;
    details.push(`Diğer schema türleri: ${crawl.technical.schemaTypes.join(", ")}`);
  } else {
    details.push("Schema.org yapılandırması yok");
  }

  return {
    score,
    max: 20,
    label: "FAQ/HowTo Schema",
    details,
  };
}

function scoreSnippetTargeting(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Meta description uygun uzunluk (snippet için 120-160 karakter ideal) → +5
  const descLen = crawl.basicInfo.metaDescription?.length || 0;
  if (descLen >= 120 && descLen <= 160) {
    score += 5;
    details.push(`Meta description snippet için ideal (${descLen} karakter)`);
  } else if (descLen >= 50 && descLen < 120) {
    score += 3;
    details.push(`Meta description kısa (${descLen} karakter)`);
  } else if (descLen > 160) {
    score += 2;
    details.push(`Meta description uzun (${descLen} karakter) — kesilecek`);
  } else {
    details.push("Meta description yok veya çok kısa");
  }

  // H2'ler soru formatında mı → +5
  const questionH2s = crawl.headings.h2.filter(
    (h) => /\?$|nasıl|nedir|neden|ne zaman|kaç|hangi|how|what|why|when|which/i.test(h.text)
  );
  if (questionH2s.length >= 3) {
    score += 5;
    details.push(`H2'ler soru formatında (${questionH2s.length} soru başlığı)`);
  } else if (questionH2s.length >= 1) {
    score += 3;
    details.push(`Bazı H2'ler soru formatında (${questionH2s.length} adet)`);
  } else {
    details.push("H2 başlıkları soru formatında değil");
  }

  // Kısa ve öz cevap yapısı (H2 sayısı / paragraf oranı) → +5
  const ratio = crawl.headings.totalH2 > 0
    ? crawl.content.paragraphCount / crawl.headings.totalH2
    : 0;
  if (ratio >= 2 && ratio <= 5) {
    score += 5;
    details.push("Her H2 altında yeterli ama kısa cevap yapısı var");
  } else if (ratio > 0) {
    score += 2;
    details.push("H2-paragraf oranı snippet için ideal değil");
  } else {
    details.push("H2 yapısı yok — snippet hedeflemesi yapılamaz");
  }

  // Content-to-code ratio yüksek → +5
  if (crawl.content.contentToCodeRatio >= 30) {
    score += 5;
    details.push(`İçerik-kod oranı iyi (%${crawl.content.contentToCodeRatio.toFixed(0)})`);
  } else if (crawl.content.contentToCodeRatio >= 15) {
    score += 2;
    details.push(`İçerik-kod oranı düşük (%${crawl.content.contentToCodeRatio.toFixed(0)})`);
  } else {
    details.push("İçerik-kod oranı çok düşük — snippet çıkarımı zor");
  }

  return {
    score,
    max: 20,
    label: "Snippet Hedefleme",
    details,
  };
}

function scoreIntentMatch(crawl: CrawlResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Title veya H1 soru içeriyor mu → +7
  const titleHasQ = /\?|nasıl|nedir|neden|ne zaman|kaç|how|what|why|when/i.test(crawl.basicInfo.title || "");
  const h1Text = crawl.headings.h1.map((h) => h.text).join(" ");
  const h1HasQ = /\?|nasıl|nedir|neden|ne zaman|kaç|how|what|why|when/i.test(h1Text);

  if (titleHasQ && h1HasQ) {
    score += 7;
    details.push("Title ve H1 soru formatında — kullanıcı niyetine uygun");
  } else if (titleHasQ || h1HasQ) {
    score += 4;
    details.push(`${titleHasQ ? "Title" : "H1"} soru formatında`);
  } else {
    details.push("Title ve H1 soru formatında değil");
  }

  // H2 yapısı kullanıcı sorularına uygun mu → +7
  const questionH2s = crawl.headings.h2.filter(
    (h) => /\?$|nasıl|nedir|neden|ne zaman|kaç|hangi|how|what|why|when|which/i.test(h.text)
  );
  if (questionH2s.length >= 3) {
    score += 7;
    details.push(`H2 başlıkları kullanıcı sorularına uygun (${questionH2s.length} soru)`);
  } else if (questionH2s.length >= 1) {
    score += 4;
    details.push(`Bazı H2'ler soru formatında (${questionH2s.length} adet)`);
  } else {
    details.push("H2 başlıkları kullanıcı sorularını yansıtmıyor");
  }

  // Tek H1 + tutarlılık → +6
  if (crawl.headings.totalH1 === 1) {
    score += 4;
    details.push("Tek H1 — odaklı sayfa yapısı");
  } else if (crawl.headings.totalH1 > 1) {
    score += 1;
    details.push(`Birden fazla H1 (${crawl.headings.totalH1}) — odak dağınık`);
  } else {
    details.push("H1 bulunamadı — sayfa odağı belirsiz");
  }

  // Title ve H1 tutarlılık kontrolü → +2
  if (crawl.headings.totalH1 === 1 && crawl.basicInfo.title) {
    const title = crawl.basicInfo.title.toLowerCase();
    const h1 = crawl.headings.h1[0]?.text.toLowerCase() || "";
    const overlap = h1.split(" ").filter((word) => title.includes(word) && word.length > 3).length;
    if (overlap >= 2) {
      score += 2;
      details.push("Title ve H1 tutarlı");
    }
  }

  return {
    score,
    max: 20,
    label: "Niyet Uyumu",
    details,
    noData: true, // Hedef soru/keyword olmadan tam analiz yapılamaz
  };
}

function scoreMeasurement(pageAnalysis: PageAnalysis, onlinePresence?: OnlinePresenceResult): AuthoritySubScore {
  let score = 0;
  const details: string[] = [];

  // Google Analytics mevcut → +5
  if (pageAnalysis.analytics.hasGoogleAnalytics) {
    score += 5;
    details.push("Google Analytics mevcut");
  } else {
    details.push("Google Analytics bulunamadı");
  }

  // GTM mevcut → +5
  if (pageAnalysis.analytics.hasGTM) {
    score += 5;
    details.push("Google Tag Manager mevcut");
  } else {
    details.push("GTM bulunamadı");
  }

  // GSC verification (webmasterTags) → +5
  const wt = onlinePresence?.webmasterTags;
  if (wt?.google) {
    score += 5;
    details.push("Google Search Console doğrulaması mevcut");
  } else {
    details.push("Google Search Console doğrulaması bulunamadı");
  }

  // Bing/Yandex webmaster → +2
  if (wt?.bing) {
    score += 2;
    details.push("Bing Webmaster doğrulaması mevcut");
  }
  if (wt?.yandex) {
    score += 1;
    details.push("Yandex Webmaster doğrulaması mevcut");
  }

  // Diğer analitik araçlar → +2
  const otherTools = [
    ...(pageAnalysis.analytics.hasMetaPixel ? ["Meta Pixel"] : []),
    ...(pageAnalysis.analytics.hasHotjar ? ["Hotjar"] : []),
    ...pageAnalysis.analytics.otherTools,
  ];
  if (otherTools.length > 0) {
    score += Math.min(otherTools.length, 2);
    details.push(`Ek analitik araçlar: ${otherTools.join(", ")}`);
  }

  score = Math.min(score, 20);

  return {
    score,
    max: 20,
    label: "Ölçüm & Takip",
    details,
  };
}

// ── Verdict ──

function determineVerdict(overall: number): AEOAuthorityReport["verdict"] {
  if (overall >= 70) return "onay";
  if (overall >= 50) return "guclendir";
  return "yeniden-yapilandir";
}

function determineColor(overall: number): AEOAuthorityReport["color"] {
  if (overall >= 80) return "green";
  if (overall >= 70) return "lime";
  if (overall >= 50) return "yellow";
  if (overall >= 30) return "orange";
  return "red";
}

// ── Community Insights ──

function selectCommunityInsights(categories: AEOAuthorityReport["categories"], overall: number): string[] {
  const insights: string[] = [];

  if (categories.answerBlocks.score < 10) {
    insights.push("Reddit: Cevap motorları kısa, net ve yapılı yanıtları tercih eder. H2 + liste formatı kullan.");
  }
  if (categories.faqHowToSchema.score < 10) {
    insights.push("Reddit: FAQ ve HowTo schema markup'ı olmadan featured snippet'a çıkmak neredeyse imkansız.");
  }
  if (categories.snippetTargeting.score < 10) {
    insights.push("Reddit: Position 0 (zero-click) için meta description + soru-cevap formatı kritik.");
  }
  if (categories.intentMatch.score < 10) {
    insights.push("Reddit: Kullanıcının sorusunu başlıklarda birebir kullanmak AEO'nun temelidir.");
  }
  if (categories.measurement.score < 10) {
    insights.push("Reddit: Ölçemediğin şeyi iyileştiremezsin. GA + GSC minimum takip altyapısıdır.");
  }
  if (overall >= 70) {
    insights.push("Reddit: AEO temeli sağlam. Şimdi People Also Ask ve voice search optimizasyonuna geç.");
  }

  if (insights.length === 0) {
    insights.push("Reddit: AEO, SEO'nun evrimleşmiş hali — cevap odaklı içerik üretmeye devam et.");
  }

  return insights;
}

// ── Action Plan ──

function buildActionPlan(verdict: AEOAuthorityReport["verdict"]): string[] {
  switch (verdict) {
    case "yeniden-yapilandir":
      return [
        "Hafta 1-2: FAQ/HowTo schema ekle + H2'leri soru formatına çevir",
        "Hafta 3: Her sayfa için 3-5 kısa cevap bloğu oluştur (40-60 kelime)",
        "Hafta 4: GA + GSC kur + ilerleme raporu çıkar",
      ];
    case "guclendir":
      return [
        "Hafta 1: Eksik schema türlerini tamamla (FAQ + HowTo)",
        "Hafta 2-3: En önemli sayfaları cevap bloğu formatına dönüştür",
        "Hafta 4: People Also Ask hedeflemesi + snippet takibi başlat",
      ];
    case "onay":
      return [
        "Hafta 1-2: Mevcut cevap bloklarını güncelleyerek zenginleştir",
        "Hafta 3: Voice search optimizasyonu (konuşma dili, kısa cevaplar)",
        "Hafta 4: Yeni soru hedefli içerik + AEO performans raporu",
      ];
  }
}

// ── Ana Fonksiyon ──

export function generateAEOAuthorityReport(
  crawl: CrawlResult,
  rawHtml: string,
  pageAnalysis: PageAnalysis,
  onlinePresence?: OnlinePresenceResult,
  crawlReliable?: boolean
): AEOAuthorityReport {
  const answerBlocks = scoreAnswerBlocks(crawl, rawHtml);
  const faqHowToSchema = scoreFAQHowToSchema(crawl);
  const snippetTargeting = scoreSnippetTargeting(crawl);
  const intentMatch = scoreIntentMatch(crawl);
  const measurement = scoreMeasurement(pageAnalysis, onlinePresence);

  // crawl güvenilir değilse ilgili kategorileri noData olarak işaretle
  if (crawlReliable === false) {
    answerBlocks.noData = true;
    snippetTargeting.noData = true;
    intentMatch.noData = true;
    if (!answerBlocks.details.includes("Bot koruması nedeniyle veri güvenilir değil")) {
      answerBlocks.details.push("Bot koruması nedeniyle veri güvenilir değil");
    }
    if (!snippetTargeting.details.includes("Bot koruması nedeniyle veri güvenilir değil")) {
      snippetTargeting.details.push("Bot koruması nedeniyle veri güvenilir değil");
    }
    if (!intentMatch.details.includes("Bot koruması nedeniyle veri güvenilir değil")) {
      intentMatch.details.push("Bot koruması nedeniyle veri güvenilir değil");
    }
  }

  const categories = { answerBlocks, faqHowToSchema, snippetTargeting, intentMatch, measurement };

  const overall = answerBlocks.score + faqHowToSchema.score + snippetTargeting.score + intentMatch.score + measurement.score;
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
