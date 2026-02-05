"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryScore, AuthoritySubScore } from "@/lib/types";

const authorityDescriptions: Record<string, string> = {
  "Intent Uyumu": "Sayfanın arama niyetine uygunluğu — title, meta description ve heading yapısı doğru mu?",
  "Topikal Otorite": "Konu hakkında ne kadar derin ve kapsamlı içerik var — iç linkler, kelime sayısı, yapılandırılmış veri",
  "Teknik Altyapı": "SEO'nun teknik temelleri — robots.txt, sitemap, canonical, indexlenme ve sayfa hızı",
  "Güven Sinyalleri": "Sitenin güvenilir görünüp görünmediği — SSL, gizlilik politikası, iletişim bilgisi, dış kaynaklar",
  "Backlink & Referans": "Sitenin dış dünyadaki bilinirliği — marka bahsetmeleri, sosyal medya varlığı, web arşivi geçmişi",
  "SEO Temeli": "GEO'nun temeli olan klasik SEO altyapısı — title, meta description, H1, canonical, robots, sitemap",
  "Yapılandırılmış Veri": "AI arama motorlarının anlayabilmesi için Schema.org, JSON-LD, Open Graph ve Twitter Card yapısı",
  "Cite Edilebilirlik": "İçeriğin AI tarafından kaynak gösterilme potansiyeli — kelime sayısı, bölümleme, dış kaynak linkleri",
  "Marka Bahsetmeleri": "Markanın web'deki bilinirliği — bahsetmeler, sosyal medya varlığı, web arşivi geçmişi",
  "LLM Görünürlüğü": "ChatGPT, Perplexity gibi AI araçlarının sitenizi bulup alıntılayabilme potansiyeli",
  "Cevap Blokları": "Sayfadaki kısa, yapılı cevap blokları — paragraf yapısı, listeler, özet bölümleri",
  "FAQ/HowTo Schema": "Cevap motorlarının anlaması için FAQPage, HowTo ve Article schema markup'ları",
  "Snippet Hedefleme": "Featured snippet (Position 0) için meta description, soru-cevap formatı ve içerik-kod oranı",
  "Niyet Uyumu": "Sayfa yapısının kullanıcı sorularına ne kadar uygun olduğu — soru formatında başlıklar, tutarlılık",
  "Ölçüm & Takip": "AEO performansını izleyebilmek için analitik ve webmaster araçları altyapısı",
  "Alaka Düzeyi": "Backlink'lerin niş ile alakası — aynı konudaki sitelerden link almak, DA/DR'den daha değerli",
  "Trafik Sinyali": "Link veren sayfanın trafik potansiyeli — indexlenme, sayfa sayısı ve rich snippet varlığı",
  "Link Çeşitliliği": "Farklı kaynaklardan gelen linklerin dağılımı — tek kaynağa bağımlılık riskli",
  "Anchor Doğallığı": "Link anchor text'lerinin doğallığı — tekrar ve generic anchor oranı",
  "Bahsetme Sinyali": "Markanın web'deki organik bahsetmeleri — sosyal medya, arşiv geçmişi ve brand mentions",
  "İçerik Derinliği": "Blog arşivinin zenginliği — yazı sayısı, kelime sayısı, bölümleme derinliği",
  "Pillar & Cluster": "Pillar içerik + destek yazılardan oluşan topikal küme yapısı — iç linkler ve başlık derinliği",
  "Özgünlük & Deneyim": "İçeriğin özgünlüğü ve deneyim kanıtları — E-E-A-T sinyalleri, görseller, yazar bilgisi",
  "Asset Üretimi": "İndirilebilir içerikler — PDF checklist, şablon, mini araç gibi kaydedilen ve paylaşılan varlıklar",
  "Dağıtım Sinyali": "İçeriğin dağıtım kanalları — sosyal medya, newsletter, video ve aktif paylaşım altyapısı",
};

function AuthorityProgressBar({ sub }: { sub: AuthoritySubScore }) {
  const pct = (sub.score / sub.max) * 100;
  const barColor =
    sub.score >= 15 ? "bg-green-500" : sub.score >= 10 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold text-gray-800">{sub.label}</span>
        <span className="text-base font-bold text-gray-900">{sub.score}/{sub.max}</span>
      </div>
      {authorityDescriptions[sub.label] && (
        <p className="text-sm text-gray-500">{authorityDescriptions[sub.label]}</p>
      )}
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {sub.details.length > 0 && (
        <ul className="space-y-1 pl-1">
          {sub.details.map((detail, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className={`mt-1 shrink-0 ${detail.includes("bulunamadı") || detail.includes("yok") || detail.includes("zayıf") || detail.includes("düşük") || detail.includes("güvenilir değil") ? "text-red-400" : "text-green-400"}`}>●</span>
              {detail}
            </li>
          ))}
        </ul>
      )}
      {sub.noData && (
        <p className="text-sm text-amber-600 flex items-center gap-1.5">
          <span>⚠</span> Veri kaynağı sınırlı — sonuçlar tahmine dayalı
        </p>
      )}
    </div>
  );
}

export type AuthorityReportLike = {
  overall: number;
  color: CategoryScore["color"];
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  categories: Record<string, AuthoritySubScore>;
  communityInsights: string[];
  actionPlan: string[];
};

export function AuthorityReportSection({
  report,
  title,
  gradient,
  borderPrefix,
}: {
  report: AuthorityReportLike;
  title: string;
  gradient: string;
  borderPrefix: string;
}) {
  const verdictConfig = {
    onay: { label: "ONAY", bg: "bg-green-100", text: "text-green-800" },
    guclendir: { label: "GÜÇLENDİR", bg: "bg-yellow-100", text: "text-yellow-800" },
    "yeniden-yapilandir": { label: "YENİDEN YAPILANDIR", bg: "bg-red-100", text: "text-red-800" },
  };

  const v = verdictConfig[report.verdict];

  const overallColor =
    report.overall >= 70 ? "text-green-600" : report.overall >= 50 ? "text-yellow-600" : "text-red-600";

  const borderColorMap: Record<string, string> = {
    purple: "border-purple-200",
    teal: "border-teal-200",
    rose: "border-rose-200",
    amber: "border-amber-200",
    lime: "border-lime-200",
  };
  const dividerColorMap: Record<string, string> = {
    purple: "border-purple-200",
    teal: "border-teal-200",
    rose: "border-rose-200",
    amber: "border-amber-200",
    lime: "border-lime-200",
  };
  const borderColor = borderColorMap[borderPrefix] || "border-purple-200";
  const dividerColor = dividerColorMap[borderPrefix] || "border-purple-200";

  const categoryEntries = Object.values(report.categories);

  return (
    <Card className={`${borderColor} bg-gradient-to-br ${gradient}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <span className={`text-2xl font-bold ${overallColor}`}>{report.overall}/100</span>
        </div>
        <div className="mt-2">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${v.bg} ${v.text}`}>
            {v.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-600">Alt Skorlar</h4>
          {categoryEntries.map((sub) => (
            <AuthorityProgressBar key={sub.label} sub={sub} />
          ))}
        </div>

        {report.communityInsights.length > 0 && (
          <div className={`space-y-2 pt-4 border-t ${dividerColor}`}>
            <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-1">
              <span>💬</span> Topluluk İçgörüleri
            </h4>
            <ul className="space-y-1.5">
              {report.communityInsights.map((insight, i) => (
                <li key={i} className="text-sm text-gray-700 bg-white/60 rounded-lg px-3 py-2">
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.actionPlan.length > 0 && (
          <div className={`space-y-2 pt-4 border-t ${dividerColor}`}>
            <h4 className="text-sm font-semibold text-gray-600 flex items-center gap-1">
              <span>📅</span> 30 Günlük Plan
            </h4>
            <ul className="space-y-1.5">
              {report.actionPlan.map((step, i) => (
                <li key={i} className="text-sm text-gray-700 bg-white/60 rounded-lg px-3 py-2">
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
