"use client";

import { OverallScoreCard } from "@/components/score-card";
import { useSiteContext } from "./site-context";
import { DNASummary } from "./dna-summary";
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

export function OverviewPage() {
  const { domain, data, tasks, loading, updateTaskStatus } = useSiteContext();

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Henüz tarama verisi yok</p>
        <p className="text-sm mt-2">Üst menüden &quot;Yeniden Tara&quot; butonuna basarak başlayın.</p>
      </div>
    );
  }

  const { scoring } = data;

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
      {/* ── 1. Kritik Uyarılar ── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-bold text-red-800">Kritik Uyarılar</span>
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

      {/* ── 2. Overall Score + DNA + AI Summary ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <OverallScoreCard score={scoring.overall} color={scoring.overallColor} />
        </div>
        <div className="md:col-span-2 space-y-4">
          {data.dna && <DNASummary dna={data.dna} />}
          {data.aiSummary && (
            <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">AI</span>
                <span className="text-sm font-semibold text-purple-800">AI Analiz</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">{data.aiSummary}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Kategori Özet Barları ── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Kategori Skorları</h2>
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
      </section>

      {/* ── 4. Hızlı Kazanımlar ── */}
      {quickWins.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎯</span>
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

      {/* ── 5. Bu Hafta Yapılacaklar ── */}
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

      {/* ── 6. Son Aktivite ── */}
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
