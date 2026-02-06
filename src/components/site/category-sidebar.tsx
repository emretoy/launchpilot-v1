"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CATEGORIES, CATEGORY_GROUPS } from "@/lib/category-config";
import { useSiteContext } from "./site-context";
import { computeCategoryScore } from "@/lib/category-config";

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export function CategorySidebar() {
  const pathname = usePathname();
  const { domain, data, tasks } = useSiteContext();
  const basePath = `/site/${encodeURIComponent(domain)}`;

  const pendingTotal = tasks.filter((t) => t.status === "pending" || t.status === "regressed").length;
  const completedTotal = tasks.filter((t) => t.status === "completed" || t.status === "verified").length;
  const totalTasks = pendingTotal + completedTotal;
  const progressPct = totalTasks > 0 ? Math.round((completedTotal / totalTasks) * 100) : 0;

  // Grup bazlı kategoriler
  const grouped = CATEGORY_GROUPS.map((group) => ({
    ...group,
    categories: CATEGORIES.filter((c) => c.group === group.key),
  }));

  function renderNavItem(item: { slug: string; label: string; icon: string }, isCategory: boolean) {
    const href = `${basePath}/${item.slug}`;
    const isActive = pathname === href || (item.slug === "overview" && pathname === basePath);
    const cat = isCategory ? CATEGORIES.find((c) => c.slug === item.slug) : null;
    const score = cat && data?.scoring ? computeCategoryScore(data.scoring, cat) : null;
    const pendingCount = cat
      ? tasks.filter(
          (t) =>
            t.category === cat.slug &&
            (t.status === "pending" || t.status === "regressed")
        ).length
      : 0;

    return (
      <Link
        key={item.slug}
        href={href}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        }`}
      >
        <span className="text-base">{item.icon}</span>
        <span className="flex-1 truncate">{item.label}</span>
        {score !== null && (
          <span className={`text-xs font-semibold ${scoreColor(score)}`}>{score}</span>
        )}
        {pendingCount > 0 && (
          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
            {pendingCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 border-r bg-muted/20 min-h-screen p-4 gap-0.5">
        {/* Genel Bakış */}
        {renderNavItem({ slug: "overview", label: "Genel Bakış", icon: "📊" }, false)}

        {/* Gruplar */}
        {grouped.map((group) => (
          <div key={group.key} className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">
              {group.label}
            </p>
            {group.categories.map((cat) => renderNavItem(cat, true))}
          </div>
        ))}

        {/* Blog */}
        <div className="mt-4">
          <Link
            href={`${basePath}/blog`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname?.includes("/blog")
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <span className="text-base">✍️</span>
            <span className="flex-1">Blog</span>
          </Link>
        </div>

        {/* Alt kısım: Görevler + Tam Rapor */}
        <div className="mt-auto pt-4 border-t space-y-0.5">
          <Link
            href={`${basePath}/gorevler`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname?.includes("/gorevler")
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <span className="text-base">✅</span>
            <span className="flex-1">Tüm Görevler</span>
            {pendingTotal > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
                {pendingTotal}
              </span>
            )}
          </Link>

          <Link
            href={`${basePath}/tam-rapor`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname?.includes("/tam-rapor")
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <span className="text-base">📋</span>
            <span className="flex-1">Tam Rapor</span>
          </Link>

          {/* İlerleme barı */}
          {totalTasks > 0 && (
            <div className="mt-3 px-3">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>{completedTotal}/{totalTasks} tamamlandı</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Mobil: yatay scroll nav */}
      <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-b bg-background sticky top-0 z-10">
        <Link
          href={`${basePath}/overview`}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
            pathname === `${basePath}/overview` || pathname === basePath
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <span>📊</span>
          <span>Genel</span>
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`${basePath}/${cat.slug}`}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
              pathname === `${basePath}/${cat.slug}`
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-muted/50 text-muted-foreground"
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </Link>
        ))}
        <Link
          href={`${basePath}/blog`}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
            pathname?.includes("/blog")
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <span>✍️</span>
          <span>Blog</span>
        </Link>
        <Link
          href={`${basePath}/gorevler`}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
            pathname?.includes("/gorevler")
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <span>✅</span>
          <span>Görevler</span>
          {pendingTotal > 0 && (
            <span className="bg-red-100 text-red-700 font-bold px-1 py-0.5 rounded-full text-[10px]">
              {pendingTotal}
            </span>
          )}
        </Link>
        <Link
          href={`${basePath}/tam-rapor`}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
            pathname?.includes("/tam-rapor")
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-muted/50 text-muted-foreground"
          }`}
        >
          <span>📋</span>
          <span>Rapor</span>
        </Link>
      </nav>
    </>
  );
}
