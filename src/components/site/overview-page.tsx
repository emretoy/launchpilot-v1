"use client";

import { OverallScoreCard } from "@/components/score-card";
import { PromptViewer } from "@/components/prompt-viewer";
import { useSiteContext } from "./site-context";
import { TaskCard } from "./task-card";
import { CATEGORIES, computeCategoryScore } from "@/lib/category-config";
import Link from "next/link";
import type { Task } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 80) return "text-green-700";
  if (score >= 60) return "text-yellow-700";
  if (score >= 40) return "text-orange-700";
  return "text-red-700";
}

// ── DNA label helpers ──
const SITE_TYPE_LABELS: Record<string, string> = {
  "e-commerce": "E-Ticaret", blog: "Blog", corporate: "Kurumsal", saas: "SaaS",
  portfolio: "Portfolyo", "landing-page": "Landing Page", forum: "Forum",
  news: "Haber", directory: "Rehber", education: "Eğitim", unknown: "Bilinmiyor",
};

const MATURITY_LABELS: Record<string, string> = {
  newborn: "Yeni", young: "Genç", growing: "Büyüyen", mature: "Olgun", veteran: "Kıdemli",
};

const AUDIENCE_LABELS: Record<string, string> = {
  B2B: "B2B", B2C: "B2C", both: "B2B+B2C", unknown: "Bilinmiyor",
};

const MARKET_LABELS: Record<string, string> = {
  local: "Yerel", national: "Ulusal", global: "Global", unknown: "Bilinmiyor",
};

const SCALE_LABELS: Record<string, string> = {
  "single-page": "Tek Sayfa", small: "Küçük", medium: "Orta", large: "Büyük", enterprise: "Kurumsal",
};

export function OverviewPage() {
  const { domain, data, tasks, loading, updateTaskStatus, rescan } = useSiteContext();

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-foreground mb-1">Henüz tarama verisi yok</p>
        <p className="text-sm text-muted-foreground mb-6">Bu siteyi analiz etmek için tarama başlatın.</p>
        <button
          onClick={rescan}
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Taranıyor...
            </>
          ) : (
            "Siteyi Tara"
          )}
        </button>
      </div>
    );
  }

  const { scoring } = data;
  const dna = data.dna;

  // ── Kritik Uyarılar ──
  const alerts: { message: string; severity: "red" | "orange" }[] = [];

  if (data.safeBrowsing?.safe === false) {
    alerts.push({ message: "Google Safe Browsing tehdidi tespit edildi!", severity: "red" });
  }
  if (data.crawl.security.isHttps === false) {
    alerts.push({ message: "Site HTTPS kullanmıyor — güvenli değil.", severity: "red" });
  }
  if (data.ssl.daysUntilExpiry !== null && data.ssl.daysUntilExpiry < 30) {
    alerts.push({
      message: `SSL sertifikası ${data.ssl.daysUntilExpiry} gün içinde sona erecek!`,
      severity: data.ssl.daysUntilExpiry < 7 ? "red" : "orange",
    });
  }
  if (scoring.overall < 40) {
    alerts.push({ message: `Genel skor kritik seviyede: ${scoring.overall}/100`, severity: "red" });
  }

  // ── Task filtreleri ──
  const allPendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "regressed"
  );

  // Hızlı Kazanımlar: Kolay + high/critical öncelik
  const quickWinPrimary = allPendingTasks.filter(
    (t) => t.effort === "Kolay" && (t.priority === "high" || t.priority === "critical")
  );
  const quickWinFallback = allPendingTasks.filter(
    (t) => t.effort === "Kolay" && t.priority !== "high" && t.priority !== "critical"
  );
  const quickWins: Task[] = [...quickWinPrimary, ...quickWinFallback].slice(0, 3);
  const quickWinIds = new Set(quickWins.map((t) => t.id));

  // Bu Hafta Yapılacaklar: quick wins haricindeki ilk 5
  const weeklyTasks = allPendingTasks
    .filter((t) => !quickWinIds.has(t.id))
    .slice(0, 5);
  const remainingCount = allPendingTasks.filter((t) => !quickWinIds.has(t.id)).length - weeklyTasks.length;

  // ── Son Aktivite istatistikleri ──
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed" || t.status === "verified").length;
  const pendingCount = allPendingTasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ── Kategori skorları ──
  const categoryScores = CATEGORIES.map((cat) => {
    const score = computeCategoryScore(scoring, cat);
    const catPendingCount = allPendingTasks.filter((t) =>
      cat.recommendationCategories.some(
        (rc) => rc.toLowerCase() === t.category.toLowerCase()
      )
    ).length;
    return { ...cat, score, pendingCount: catPendingCount };
  });

  return (
    <div className="space-y-6">

      {/* ══════════════════════════════════════════════════════════
          BÖLÜM 1: SİTE KİMLİĞİ
          ══════════════════════════════════════════════════════════ */}
      {dna && (
        <section className="rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 p-5 md:p-6">
          {/* Brand + Badges */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="text-xl">&#x1F9EC;</span>
            <h2 className="text-lg font-bold text-indigo-900">{dna.identity.brandName}</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              {SITE_TYPE_LABELS[dna.identity.siteType] || dna.identity.siteType}
            </span>
            {dna.identity.industry && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                {dna.identity.industry}
              </span>
            )}
          </div>

          {/* 4'lü mini stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl bg-white/70 border border-indigo-100 px-3 py-2.5 text-center">
              <div className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mb-0.5">Kitle</div>
              <div className="text-sm font-bold text-indigo-900">{AUDIENCE_LABELS[dna.targetMarket.audience] || dna.targetMarket.audience}</div>
            </div>
            <div className="rounded-xl bg-white/70 border border-indigo-100 px-3 py-2.5 text-center">
              <div className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mb-0.5">Pazar</div>
              <div className="text-sm font-bold text-indigo-900">{MARKET_LABELS[dna.targetMarket.marketScope] || dna.targetMarket.marketScope}</div>
            </div>
            <div className="rounded-xl bg-white/70 border border-indigo-100 px-3 py-2.5 text-center">
              <div className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mb-0.5">Olgunluk</div>
              <div className="text-sm font-bold text-indigo-900">
                {MATURITY_LABELS[dna.maturity.level] || dna.maturity.level}
                <span className="text-indigo-400 font-normal text-xs ml-1">({dna.maturity.score})</span>
              </div>
            </div>
            <div className="rounded-xl bg-white/70 border border-indigo-100 px-3 py-2.5 text-center">
              <div className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mb-0.5">Ölçek</div>
              <div className="text-sm font-bold text-indigo-900">{SCALE_LABELS[dna.scale.level] || dna.scale.level}</div>
            </div>
          </div>

          {/* AI Site Açıklaması — TAM GÖSTERİM */}
          {(dna.aiAnalysis?.summary || dna.aiSynthesis.summary) && (
            <div className="rounded-xl bg-white/60 border border-indigo-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">AI</span>
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Site Açıklaması</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{dna.aiAnalysis?.summary || dna.aiSynthesis.summary}</p>
              {dna._prompts?.gemini && (
                <div className="mt-3">
                  <PromptViewer label="DNA Analiz Prompt'u (Gemini)" prompt={dna._prompts.gemini} />
                </div>
              )}
            </div>
          )}

          {/* v3: İş Kimliği + Hedef Kitle + Blog Stratejisi kartları */}
          {dna.aiAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {/* İş Kimliği */}
              <div className="rounded-xl bg-white/60 border border-indigo-100 p-3">
                <div className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mb-1.5">İş Kimliği</div>
                <p className="text-sm font-medium text-indigo-900 mb-1">{dna.aiAnalysis.business_identity.what_it_does}</p>
                <p className="text-xs text-gray-600">{dna.aiAnalysis.business_identity.value_proposition}</p>
              </div>

              {/* Hedef Kitle */}
              <div className="rounded-xl bg-white/60 border border-indigo-100 p-3">
                <div className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mb-1.5">Hedef Kitle</div>
                <p className="text-sm font-medium text-indigo-900 mb-1">{dna.aiAnalysis.target_audience.primary_audience}</p>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{dna.aiAnalysis.target_audience.awareness_level}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{dna.aiAnalysis.target_audience.funnel_focus}</span>
                </div>
              </div>

              {/* Blog Stratejisi */}
              <div className="rounded-xl bg-white/60 border border-indigo-100 p-3">
                <div className="text-[10px] font-medium text-indigo-500 uppercase tracking-wide mb-1.5">Blog Stratejisi</div>
                <p className="text-sm font-medium text-indigo-900 mb-1">
                  {dna.aiAnalysis.blog_strategy_verdict.should_blog ? "Blog önerilir" : "Blog öncelikli değil"}
                </p>
                {dna.aiAnalysis.blog_strategy_verdict.blog_role && (
                  <p className="text-xs text-gray-600 mb-1">{dna.aiAnalysis.blog_strategy_verdict.blog_role}</p>
                )}
                {dna.aiAnalysis.blog_strategy_verdict.priority_topics.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {dna.aiAnalysis.blog_strategy_verdict.priority_topics.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          BÖLÜM 2: SKOR & TEKNİK ANALİZ
          ══════════════════════════════════════════════════════════ */}
      <section className="rounded-2xl border border-border bg-background p-5 md:p-6 space-y-5">
        {/* Skor + Uyarılar + AI Teknik Özet */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <OverallScoreCard score={scoring.overall} color={scoring.overallColor} />
          </div>
          <div className="md:col-span-2 space-y-3">
            {/* Kritik Uyarılar */}
            {alerts.length > 0 && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-bold text-red-800 uppercase tracking-wide">Kritik Uyarılar</span>
                </div>
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`text-sm font-medium px-3 py-1.5 rounded-lg ${
                      alert.severity === "red"
                        ? "bg-red-100 text-red-800"
                        : "bg-orange-100 text-orange-800"
                    }`}
                  >
                    {alert.message}
                  </div>
                ))}
              </div>
            )}

            {/* AI Teknik Özet */}
            {data.aiSummary && (
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">AI</span>
                  <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Teknik Analiz</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{data.aiSummary}</p>
                {data.aiPrompt && (
                  <div className="mt-3">
                    <PromptViewer label="Teknik Sağlık Özeti Prompt'u (Gemini)" prompt={data.aiPrompt} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Kategori Özet Barları */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Kategori Skorları</h3>
          <div className="space-y-2">
            {categoryScores.map((cat) => {
              const score = cat.score;
              const hasScore = score !== null;

              return (
                <Link
                  key={cat.slug}
                  href={`/site/${encodeURIComponent(domain)}/${cat.slug}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 hover:bg-muted/30 transition-colors group"
                >
                  {/* Icon */}
                  <span className="text-lg w-7 text-center flex-shrink-0">{cat.icon}</span>

                  {/* Label */}
                  <span className="text-sm font-medium w-28 flex-shrink-0 group-hover:text-primary transition-colors">
                    {cat.label}
                  </span>

                  {/* Score Bar */}
                  <div className="flex-1 h-3 bg-muted/40 rounded-full overflow-hidden">
                    {hasScore && (
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${scoreColor(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    )}
                  </div>

                  {/* Score Number */}
                  <span
                    className={`text-sm font-bold w-10 text-right flex-shrink-0 ${
                      hasScore ? scoreTextColor(score) : "text-muted-foreground"
                    }`}
                  >
                    {hasScore ? score : "N/A"}
                  </span>

                  {/* Pending Task Count */}
                  {cat.pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full w-5 h-5 flex-shrink-0">
                      {cat.pendingCount}
                    </span>
                  )}

                  {/* Arrow */}
                  <svg className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          BÖLÜM 3: YAPILACAKLAR
          ══════════════════════════════════════════════════════════ */}

      {/* Hızlı Kazanımlar */}
      {quickWins.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">&#x1F3AF;</span>
            <h2 className="text-lg font-semibold">Hızlı Kazanımlar — Hemen Yapılabilir</h2>
          </div>
          <div className="space-y-2">
            {quickWins.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={updateTaskStatus}
              />
            ))}
          </div>
        </section>
      )}

      {/* Bu Hafta Yapılacaklar */}
      {weeklyTasks.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Bu Hafta Yapılacaklar</h2>
          <div className="space-y-2">
            {weeklyTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={updateTaskStatus}
              />
            ))}
          </div>
          {remainingCount > 0 && (
            <Link
              href={`/site/${encodeURIComponent(domain)}/gorevler`}
              className="inline-block text-sm text-primary hover:underline mt-3"
            >
              +{remainingCount} görev daha
            </Link>
          )}
        </section>
      )}

      {/* Son Aktivite */}
      {totalTasks > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Son Aktivite</h2>
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="flex gap-4">
                <span className="text-muted-foreground">
                  Toplam: <span className="font-semibold text-foreground">{totalTasks}</span>
                </span>
                <span className="text-muted-foreground">
                  Tamamlanan: <span className="font-semibold text-green-600">{completedTasks}</span>
                </span>
                <span className="text-muted-foreground">
                  Bekleyen: <span className="font-semibold text-orange-600">{pendingCount}</span>
                </span>
              </div>
              <span className="text-sm font-bold text-foreground">{progressPercent}%</span>
            </div>
            <div className="h-3 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
