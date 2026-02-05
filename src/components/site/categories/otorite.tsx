"use client";

import { useState } from "react";
import { useSiteContext } from "@/components/site/site-context";
import { AuthorityReportSection } from "@/components/shared/authority-report";
import type { AuthorityReportLike } from "@/components/shared/authority-report";

const TABS = [
  { key: "seo", label: "SEO" },
  { key: "geo", label: "GEO" },
  { key: "aeo", label: "AEO" },
  { key: "backlink", label: "Backlink" },
  { key: "blog", label: "Blog" },
] as const;

const reportConfig: Record<string, { title: string; gradient: string; borderPrefix: string }> = {
  seo: { title: "SEO Otorite Raporu", gradient: "from-purple-50 to-indigo-50", borderPrefix: "purple" },
  geo: { title: "GEO Otorite Raporu", gradient: "from-teal-50 to-cyan-50", borderPrefix: "teal" },
  aeo: { title: "AEO Otorite Raporu", gradient: "from-rose-50 to-pink-50", borderPrefix: "rose" },
  backlink: { title: "Backlink Otorite Raporu", gradient: "from-amber-50 to-yellow-50", borderPrefix: "amber" },
  blog: { title: "Blog Otorite Raporu", gradient: "from-lime-50 to-green-50", borderPrefix: "lime" },
};

export function OtoritePage() {
  const { data } = useSiteContext();
  const [activeTab, setActiveTab] = useState<string>("seo");

  if (!data) return <div className="text-muted-foreground py-8">Veri yükleniyor...</div>;

  const reports: Record<string, AuthorityReportLike | undefined> = {
    seo: data.seoAuthority as AuthorityReportLike | undefined,
    geo: data.geoAuthority as AuthorityReportLike | undefined,
    aeo: data.aeoAuthority as AuthorityReportLike | undefined,
    backlink: data.backlinkAuthority as AuthorityReportLike | undefined,
    blog: data.blogAuthority as AuthorityReportLike | undefined,
  };

  const activeReport = reports[activeTab];
  const config = reportConfig[activeTab];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <span className="text-4xl">👑</span>
        <div>
          <h1 className="text-2xl font-bold">Otorite Raporları</h1>
          <p className="text-sm text-muted-foreground mt-1">
            5 farklı otorite boyutunda detaylı analiz
          </p>
        </div>
      </div>

      {/* Tab'lar */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-lg overflow-x-auto">
        {TABS.map((tab) => {
          const report = reports[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {report && (
                <span className={`text-xs font-bold ${
                  report.overall >= 70 ? "text-green-600" : report.overall >= 50 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {report.overall}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Aktif Rapor */}
      {activeReport && config ? (
        <AuthorityReportSection
          report={activeReport}
          title={config.title}
          gradient={config.gradient}
          borderPrefix={config.borderPrefix}
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Bu rapor için veri bulunamadı.
        </div>
      )}
    </div>
  );
}
