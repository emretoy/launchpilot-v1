import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { crawlSite } from "@/lib/crawler";
import { getPageSpeedResults } from "@/lib/pagespeed";
import { checkSSL } from "@/lib/ssl-checker";
import { getDomainInfo } from "@/lib/domain-info";
import { checkSecurityHeaders } from "@/lib/security-headers";
import { checkSafeBrowsing } from "@/lib/safe-browsing";
import { checkDNS } from "@/lib/dns-checker";
import { validateHTML } from "@/lib/html-validator";
import { analyzePage, fetchAboutPageSummary } from "@/lib/page-analyzer";
import { calculateScores } from "@/lib/scoring";
import { generateRecommendations } from "@/lib/recommendations";
import { buildTreatmentPlan, normalizeRecKey } from "@/lib/treatment-plan";
import { generateAISummary } from "@/lib/gemini";
import { generateSEOAuthorityReport } from "@/lib/seo-authority";
import { generateGEOAuthorityReport } from "@/lib/geo-authority";
import { generateAEOAuthorityReport } from "@/lib/aeo-authority";
import { generateBacklinkAuthorityReport } from "@/lib/backlink-authority";
import { generateBlogAuthorityReport } from "@/lib/blog-authority";
import { analyzeWebsiteDNA } from "@/lib/dna-analyzer";
import { getServiceSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { runFullValidation } from "@/lib/validator";
import {
  checkGoogleIndex,
  checkWaybackHistory,
  analyzeOnlinePresence,
} from "@/lib/online-presence";
import { syncTasksFromScan } from "@/lib/task-sync";
import type { FullAnalysisResult, OnlinePresenceResult } from "@/lib/types";

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  // Validate URL
  new URL(url);
  return url;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Phase 1: Paralel çağrılar
    const domain = new URL(normalizedUrl).hostname.replace(/^www\./, "");
    const [crawlData, pageSpeed, ssl, domainInfo, securityHeaders, safeBrowsing, dns, htmlValidation, googleIndex, waybackHistory] =
      await Promise.all([
        crawlSite(normalizedUrl),
        getPageSpeedResults(normalizedUrl),
        checkSSL(normalizedUrl),
        getDomainInfo(normalizedUrl),
        checkSecurityHeaders(normalizedUrl),
        checkSafeBrowsing(normalizedUrl),
        checkDNS(normalizedUrl),
        validateHTML(normalizedUrl),
        checkGoogleIndex(domain, domain.split(".")[0]),
        checkWaybackHistory(domain),
      ]);

    const crawl = crawlData.result;
    const rawHtml = crawlData.rawHtml;

    // Phase 2: Crawl sonucuna bağlı analizler (crawler'ın HTML'ini kullan — ek HTTP isteği yok)
    const $ = cheerio.load(rawHtml);
    const pageAnalysis = analyzePage($, rawHtml, normalizedUrl);

    // Bot koruması veya engelleme durumunda HTML çok küçük olabilir → veri güvenilmez
    const crawlReliable = rawHtml.length > 5000;

    // Phase 2.3: About Page Fetch (paralel — DNA'ya paralel çalışır)
    const aboutPagePromise = fetchAboutPageSummary(normalizedUrl, crawl.links.internal)
      .catch((err) => {
        console.error("About page fetch error (skipping):", err);
        return null;
      });

    // Phase 2.5: Website DNA Analizi (about page paralel devam ederken başlıyor)
    let dna;
    try {
      dna = await analyzeWebsiteDNA(crawl, pageAnalysis, domainInfo, dns, ssl, rawHtml);
    } catch (err) {
      console.error("DNA analysis error (skipping):", err);
    }

    // About page sonucunu al ve businessSignals'a ata
    const aboutPageSummary = await aboutPagePromise;
    if (aboutPageSummary) {
      pageAnalysis.businessSignals.aboutPageSummary = aboutPageSummary;
    }

    // Phase 2.7: Online Presence Tamamla (crawl sonrası veriler)
    let onlinePresence: OnlinePresenceResult | undefined;
    try {
      onlinePresence = await analyzeOnlinePresence(
        domain,
        dna?.identity.brandName || domain.split(".")[0],
        crawl,
        pageAnalysis.socialLinks,
        rawHtml,
        googleIndex,
        waybackHistory
      );
    } catch (err) {
      console.error("Online presence analysis error (skipping):", err);
    }

    // Phase 3: Puanlama
    const scoring = calculateScores(
      crawl,
      pageSpeed,
      ssl,
      domainInfo,
      securityHeaders,
      safeBrowsing,
      dns,
      htmlValidation,
      pageAnalysis,
      onlinePresence,
      crawlReliable
    );

    // Phase 3.5: Otorite Raporları (SEO + GEO + AEO)
    const seoAuthority = generateSEOAuthorityReport(
      crawl, pageSpeed, ssl, pageAnalysis, onlinePresence, crawlReliable
    );
    const geoAuthority = generateGEOAuthorityReport(
      crawl, pageAnalysis, onlinePresence, crawlReliable
    );
    const aeoAuthority = generateAEOAuthorityReport(
      crawl, rawHtml, pageAnalysis, onlinePresence, crawlReliable
    );
    const backlinkAuthority = generateBacklinkAuthorityReport(
      crawl, pageAnalysis, onlinePresence, crawlReliable
    );
    const blogAuthority = generateBlogAuthorityReport(
      crawl, rawHtml, pageAnalysis, onlinePresence, dna, crawlReliable
    );

    // Phase 4: Öneriler
    const recommendations = generateRecommendations(
      crawl, pageSpeed, ssl, domainInfo, securityHeaders,
      safeBrowsing, dns, htmlValidation, pageAnalysis, scoring,
      onlinePresence, crawlReliable
    );

    // Phase 4.5: Tedavi Planı
    const treatmentPlan = buildTreatmentPlan(recommendations);

    // Phase 5: Veri Doğrulama (validation)
    let validatedCrawl = crawl;
    let validatedPageAnalysis = pageAnalysis;
    let validatedScoring = scoring;
    let validationSummary = null;

    if (rawHtml) {
      try {
        const validationResult = await runFullValidation(
          crawl,
          pageAnalysis,
          scoring,
          rawHtml,
          dna,
          dns,
          domainInfo,
          onlinePresence
        );
        validatedCrawl = validationResult.crawl;
        validatedPageAnalysis = validationResult.pageAnalysis;
        validatedScoring = validationResult.scoring;
        if (validationResult.dna) dna = validationResult.dna;
        validationSummary = validationResult.validationSummary;
      } catch (err) {
        console.error("Validation error (skipping):", err);
      }
    }

    // Phase 6: AI Özeti (opsiyonel — hata olursa null)
    const aiResult = await generateAISummary(validatedScoring, recommendations, validatedCrawl, ssl, htmlValidation, dna);
    const aiSummary = aiResult.text;
    const aiPrompt = aiResult.prompt || null;

    const duration = Date.now() - startTime;

    const analyzedAt = new Date().toISOString();

    const result: FullAnalysisResult = {
      crawl: validatedCrawl,
      pageSpeed,
      ssl,
      domainInfo,
      securityHeaders,
      safeBrowsing,
      dns,
      htmlValidation,
      pageAnalysis: validatedPageAnalysis,
      scoring: validatedScoring,
      recommendations,
      treatmentPlan,
      dna,
      onlinePresence,
      seoAuthority,
      geoAuthority,
      aeoAuthority,
      backlinkAuthority,
      blogAuthority,
      aiSummary,
      aiPrompt,
      validationSummary,
      analyzedAt,
      duration,
    };

    // Kullanıcı session'ını al (opsiyonel — giriş yapmamışsa null)
    let userId: string | null = null;
    try {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const authClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user } } = await authClient.auth.getUser(token);
        userId = user?.id ?? null;
      }
    } catch {
      // Auth hatası — userId null kalır
    }

    // Supabase'e kaydet (fire-and-forget — response'u geciktirmesin)
    const recommendationKeys = recommendations.map(normalizeRecKey);
    const supabaseAdmin = getServiceSupabase();

    const baseInsertData = {
      domain,
      url: normalizedUrl,
      overall_score: validatedScoring.overall,
      category_scores: {
        performance: validatedScoring.categories.performance.score,
        seo: validatedScoring.categories.seo.score,
        security: validatedScoring.categories.security.score,
        accessibility: validatedScoring.categories.accessibility.score,
        bestPractices: validatedScoring.categories.bestPractices.score,
        domainTrust: validatedScoring.categories.domainTrust.score,
        content: validatedScoring.categories.content.score,
        technology: validatedScoring.categories.technology.score,
        onlinePresence: validatedScoring.categories.onlinePresence.score,
      },
      recommendation_keys: recommendationKeys,
      recommendations_count: recommendations.length,
      duration,
      analyzed_at: analyzedAt,
      user_id: userId,
    };

    // result_json ile dene, başarısızsa onsuz dene
    async function saveScan() {
      // İlk deneme: result_json dahil
      const { data: scanRow, error } = await supabaseAdmin
        .from("scans")
        .insert({ ...baseInsertData, result_json: result })
        .select("id")
        .single();

      if (!error && scanRow) {
        // Task sync
        if (userId) {
          syncTasksFromScan(supabaseAdmin, userId, domain, recommendations, scanRow.id, result)
            .catch((err) => console.error("Task sync error:", err));
        }
        return;
      }

      // result_json kolonu yoksa fallback: onsuz kaydet
      console.error("Scan insert with result_json failed:", error?.message);
      const { data: fallbackRow, error: fallbackErr } = await supabaseAdmin
        .from("scans")
        .insert(baseInsertData)
        .select("id")
        .single();

      if (fallbackErr) {
        console.error("Scan insert fallback also failed:", fallbackErr.message);
        return;
      }

      if (userId && fallbackRow) {
        syncTasksFromScan(supabaseAdmin, userId, domain, recommendations, fallbackRow.id, result)
          .catch((err) => console.error("Task sync error:", err));
      }
    }

    saveScan().catch((err) => console.error("Save scan error:", err));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An error occurred during analysis",
      },
      { status: 500 }
    );
  }
}
