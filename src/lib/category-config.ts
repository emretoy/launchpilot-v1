import type { ScoringResult } from "./types";

export interface CategoryConfig {
  slug: string;
  label: string;
  icon: string;
  group: "saglik" | "arama" | "dis";
  scoringKeys: (keyof ScoringResult["categories"])[];
  recommendationCategories: string[];
  description: string;
}

export const CATEGORY_GROUPS = [
  { key: "saglik", label: "Site Sağlığı" },
  { key: "arama", label: "Arama & İçerik" },
  { key: "dis", label: "Dış Dünya" },
] as const;

export const CATEGORIES: CategoryConfig[] = [
  {
    slug: "performans",
    label: "Performans",
    icon: "⚡",
    group: "saglik",
    scoringKeys: ["performance"],
    recommendationCategories: ["Performans"],
    description: "Sayfa hızı, Core Web Vitals ve yükleme süresi",
  },
  {
    slug: "guvenlik",
    label: "Güvenlik",
    icon: "🛡️",
    group: "saglik",
    scoringKeys: ["security", "domainTrust"],
    recommendationCategories: ["Guvenlik", "Domain Guven"],
    description: "SSL, güvenlik başlıkları ve domain güvenilirliği",
  },
  {
    slug: "teknoloji",
    label: "Teknoloji",
    icon: "🔧",
    group: "saglik",
    scoringKeys: ["technology", "bestPractices", "accessibility"],
    recommendationCategories: ["Teknoloji", "Best Practices", "Erisilebilirlik"],
    description: "Teknoloji yığını, en iyi uygulamalar ve erişilebilirlik",
  },
  {
    slug: "seo",
    label: "SEO",
    icon: "🔍",
    group: "arama",
    scoringKeys: ["seo"],
    recommendationCategories: ["SEO"],
    description: "Meta etiketler, başlıklar, site haritası ve arama otorite raporları",
  },
  {
    slug: "icerik",
    label: "İçerik",
    icon: "📝",
    group: "arama",
    scoringKeys: ["content"],
    recommendationCategories: ["Icerik"],
    description: "İçerik kalitesi, blog otoritesi ve içerik stratejisi",
  },
  {
    slug: "dijital-varlik",
    label: "Dijital Varlık",
    icon: "🌐",
    group: "dis",
    scoringKeys: ["onlinePresence"],
    recommendationCategories: ["Dijital Varlik"],
    description: "Google indeksleme, sosyal profiller, backlink otoritesi ve web geçmişi",
  },
];

export function getCategoryBySlug(slug: string): CategoryConfig | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getCategoryForRecommendation(recCategory: string): CategoryConfig | undefined {
  // Normalize: remove Turkish chars for matching
  const norm = recCategory
    .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ı/g, "i")
    .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ç/g, "C")
    .replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O");

  return CATEGORIES.find((cat) =>
    cat.recommendationCategories.some((rc) => {
      const rcNorm = rc
        .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
        .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ı/g, "i")
        .replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ç/g, "C")
        .replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O");
      return rcNorm.toLowerCase() === norm.toLowerCase();
    })
  );
}

// Scoring weights per category (from scoring.ts)
const SCORING_WEIGHTS: Record<string, number> = {
  performance: 0.18,
  seo: 0.18,
  security: 0.14,
  accessibility: 0.09,
  bestPractices: 0.09,
  domainTrust: 0.09,
  content: 0.09,
  technology: 0.04,
  onlinePresence: 0.10,
};

export function computeCategoryScore(
  scoring: ScoringResult,
  category: CategoryConfig
): number | null {
  if (category.scoringKeys.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const key of category.scoringKeys) {
    const cat = scoring.categories[key];
    if (cat.noData) continue;
    const weight = SCORING_WEIGHTS[key] || 0.1;
    weightedSum += cat.score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}
