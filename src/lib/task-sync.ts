import type { SupabaseClient } from "@supabase/supabase-js";
import type { Recommendation, FullAnalysisResult } from "./types";
import { normalizeRecKey } from "./treatment-plan";
import { getCategoryForRecommendation } from "./category-config";

interface ExistingTask {
  id: string;
  recommendation_key: string;
  status: string;
}

function mapEffort(effort: Recommendation["effort"]): "Kolay" | "Orta" | "Zor" {
  return effort;
}

function mapPriority(priority: Recommendation["priority"]): string {
  return priority;
}

function mapCategory(recCategory: string): string {
  const cat = getCategoryForRecommendation(recCategory);
  return cat?.slug || "diger";
}

// Authority raporlarından görev çıkar
interface AuthorityTaskInput {
  reportType: string; // seo, geo, aeo, backlink, blog
  label: string;
  verdict: "onay" | "guclendir" | "yeniden-yapilandir";
  actionPlan: string[];
}

function extractAuthorityTasks(result: FullAnalysisResult): AuthorityTaskInput[] {
  const reports: AuthorityTaskInput[] = [];

  if (result.seoAuthority?.actionPlan?.length) {
    reports.push({
      reportType: "seo-authority",
      label: "SEO Otorite",
      verdict: result.seoAuthority.verdict,
      actionPlan: result.seoAuthority.actionPlan,
    });
  }
  if (result.geoAuthority?.actionPlan?.length) {
    reports.push({
      reportType: "geo-authority",
      label: "GEO Otorite",
      verdict: result.geoAuthority.verdict,
      actionPlan: result.geoAuthority.actionPlan,
    });
  }
  if (result.aeoAuthority?.actionPlan?.length) {
    reports.push({
      reportType: "aeo-authority",
      label: "AEO Otorite",
      verdict: result.aeoAuthority.verdict,
      actionPlan: result.aeoAuthority.actionPlan,
    });
  }
  if (result.backlinkAuthority?.actionPlan?.length) {
    reports.push({
      reportType: "backlink-authority",
      label: "Backlink Otorite",
      verdict: result.backlinkAuthority.verdict,
      actionPlan: result.backlinkAuthority.actionPlan,
    });
  }
  if (result.blogAuthority?.actionPlan?.length) {
    reports.push({
      reportType: "blog-authority",
      label: "Blog Otorite",
      verdict: result.blogAuthority.verdict,
      actionPlan: result.blogAuthority.actionPlan,
    });
  }

  return reports;
}

function verdictToPriority(verdict: AuthorityTaskInput["verdict"]): string {
  if (verdict === "yeniden-yapilandir") return "high";
  if (verdict === "guclendir") return "medium";
  return "low";
}

// Authority report type → sidebar kategori slug mapping
function authorityCategory(reportType: string): string {
  switch (reportType) {
    case "seo-authority":
    case "geo-authority":
    case "aeo-authority":
      return "seo";
    case "blog-authority":
      return "icerik";
    case "backlink-authority":
      return "dijital-varlik";
    default:
      return "seo";
  }
}

export async function syncTasksFromScan(
  supabase: SupabaseClient,
  userId: string,
  domain: string,
  recommendations: Recommendation[],
  scanId: string | null,
  fullResult?: FullAnalysisResult
): Promise<void> {
  // 1. Mevcut task'ları çek
  const { data: existingTasks, error: fetchError } = await supabase
    .from("tasks")
    .select("id, recommendation_key, status")
    .eq("user_id", userId)
    .eq("domain", domain);

  if (fetchError) {
    console.error("Task fetch error:", fetchError);
    return;
  }

  const existing: ExistingTask[] = existingTasks || [];
  const existingMap = new Map(existing.map((t) => [t.recommendation_key, t]));

  // 2. Yeni recommendation key'leri
  const newRecKeys = new Set(recommendations.map((r) => normalizeRecKey(r)));

  // 3. Yeni task'lar (mevcut olmayan recommendation'lar)
  const toInsert = recommendations.filter(
    (r) => !existingMap.has(normalizeRecKey(r))
  );

  // 4. Completed ama artık recommendation yok → verified
  const toVerify = existing.filter(
    (t) => t.status === "completed" && !newRecKeys.has(t.recommendation_key)
  );

  // 5. Verified ama recommendation tekrar var → regressed
  const toRegress = existing.filter(
    (t) => t.status === "verified" && newRecKeys.has(t.recommendation_key)
  );

  // Insert new tasks
  if (toInsert.length > 0) {
    const rows = toInsert.map((r) => ({
      user_id: userId,
      domain,
      category: mapCategory(r.category),
      priority: mapPriority(r.priority),
      title: r.title,
      description: r.description,
      how_to: r.howTo,
      effort: mapEffort(r.effort),
      recommendation_key: normalizeRecKey(r),
      status: "pending",
      scan_id: scanId,
    }));

    const { error } = await supabase.from("tasks").upsert(rows, {
      onConflict: "user_id,domain,recommendation_key",
      ignoreDuplicates: true,
    });
    if (error) console.error("Task insert error:", error);
  }

  // Verify completed tasks
  if (toVerify.length > 0) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .in("id", toVerify.map((t) => t.id));
    if (error) console.error("Task verify error:", error);
  }

  // Regress verified tasks
  if (toRegress.length > 0) {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "regressed", verified_at: null })
      .in("id", toRegress.map((t) => t.id));
    if (error) console.error("Task regress error:", error);
  }

  // Authority report'larından görev oluştur
  if (fullResult) {
    const authorityInputs = extractAuthorityTasks(fullResult);
    const authorityRows = authorityInputs.flatMap((report) =>
      report.actionPlan.map((action, idx) => {
        const recKey = `authority_${report.reportType}_${idx}`;
        // Zaten varsa ekleme
        if (existingMap.has(recKey)) return null;
        return {
          user_id: userId,
          domain,
          category: authorityCategory(report.reportType),
          priority: verdictToPriority(report.verdict),
          title: action.length > 120 ? action.slice(0, 117) + "..." : action,
          description: `${report.label} raporu önerisi`,
          how_to: action,
          effort: "Orta" as const,
          recommendation_key: recKey,
          status: "pending",
          scan_id: scanId,
        };
      })
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    if (authorityRows.length > 0) {
      const { error } = await supabase.from("tasks").upsert(authorityRows, {
        onConflict: "user_id,domain,recommendation_key",
        ignoreDuplicates: true,
      });
      if (error) console.error("Authority task insert error:", error);
    }
  }
}
