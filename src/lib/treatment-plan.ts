import type { Recommendation, TreatmentPhase, TreatmentPlan } from "./types";

export function normalizeRecKey(rec: { category: string; title: string }): string {
  const cat = rec.category.toLowerCase()
    .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ı/g, "i")
    .replace(/[^a-z]/g, "");
  const title = rec.title.toLowerCase()
    .replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ı/g, "i")
    .replace(/[0-9]+/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `${cat}::${title}`;
}

export function buildTreatmentPlan(recommendations: Recommendation[]): TreatmentPlan {
  const acilSteps = recommendations.filter(
    (r) => r.priority === "critical" || r.priority === "high"
  );
  const temelSteps = recommendations.filter((r) => r.priority === "medium");
  const ileriSteps = recommendations.filter((r) => r.priority === "low");

  const phases: TreatmentPhase[] = [];

  if (acilSteps.length > 0) {
    phases.push({
      id: "acil",
      name: "Acil Müdahale",
      description: "Hemen yapılması gereken kritik düzeltmeler. Bu adımlar sitenin sağlığını doğrudan etkiliyor.",
      steps: acilSteps,
    });
  }

  if (temelSteps.length > 0) {
    phases.push({
      id: "temel",
      name: "Temel İyileştirmeler",
      description: "Sitenin temelini güçlendiren orta öncelikli iyileştirmeler.",
      steps: temelSteps,
    });
  }

  if (ileriSteps.length > 0) {
    phases.push({
      id: "ileri",
      name: "İleri Optimizasyon",
      description: "Siteyi bir üst seviyeye taşıyacak ince ayarlar ve ek iyileştirmeler.",
      steps: ileriSteps,
    });
  }

  return {
    phases,
    totalSteps: recommendations.length,
  };
}
