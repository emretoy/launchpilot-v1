"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getBrowserSupabase } from "@/lib/supabase";
import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScanRow {
  id: string;
  domain: string;
  url: string;
  overall_score: number;
  category_scores: Record<string, number>;
  analyzed_at: string;
  duration: number;
}

const categoryLabels: Record<string, string> = {
  performance: "Performans",
  seo: "SEO",
  security: "Güvenlik",
  accessibility: "Erişilebilirlik",
  bestPractices: "Best Practices",
  domainTrust: "Domain Güven",
  content: "İçerik",
  technology: "Teknoloji",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-50";
  if (score >= 60) return "bg-yellow-50";
  if (score >= 40) return "bg-orange-50";
  return "bg-red-50";
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) return <span className="text-xs text-muted-foreground ml-1">=</span>;
  const isPositive = diff > 0;
  return (
    <span
      className={`text-xs font-medium ml-1 ${
        isPositive ? "text-green-600" : "text-red-600"
      }`}
    >
      {isPositive ? "+" : ""}
      {diff}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
        </main>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

function CompareContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scanA, setScanA] = useState<ScanRow | null>(null);
  const [scanB, setScanB] = useState<ScanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const idA = searchParams.get("a");
  const idB = searchParams.get("b");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !idA || !idB) return;

    const supabase = getBrowserSupabase();
    Promise.all([
      supabase
        .from("scans")
        .select("id, domain, url, overall_score, category_scores, analyzed_at, duration")
        .eq("id", idA)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("scans")
        .select("id, domain, url, overall_score, category_scores, analyzed_at, duration")
        .eq("id", idB)
        .eq("user_id", user.id)
        .single(),
    ]).then(([resA, resB]) => {
      if (resA.error || resB.error || !resA.data || !resB.data) {
        setError("Analizler bulunamadı.");
        setLoading(false);
        return;
      }
      // Eskiyi sola, yeniyi sağa koy
      const a = resA.data as ScanRow;
      const b = resB.data as ScanRow;
      if (new Date(a.analyzed_at) <= new Date(b.analyzed_at)) {
        setScanA(a);
        setScanB(b);
      } else {
        setScanA(b);
        setScanB(a);
      }
      setLoading(false);
    });
  }, [user, idA, idB]);

  if (authLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Yükleniyor...</div>
      </main>
    );
  }

  if (error || !scanA || !scanB) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error || "Bir hata oluştu."}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Dashboard&apos;a Dön
        </Button>
      </main>
    );
  }

  const overallDiff = scanB.overall_score - scanA.overall_score;
  const allCategories = Object.keys(categoryLabels);

  return (
    <main className="min-h-screen px-4 pb-12">
      {/* Header */}
      <header className="max-w-5xl mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-bold tracking-tight cursor-pointer"
            onClick={() => router.push("/")}
          >
            LaunchPilot
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </Button>
        </div>
        <AuthButton />
      </header>

      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Karşılaştırma</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {scanA.domain} — iki farklı tarihli analiz
        </p>

        {/* Genel Skor Karşılaştırması */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Önceki */}
          <Card className={scoreBg(scanA.overall_score)}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Önceki
              </p>
              <CardTitle className="text-sm">{formatDate(scanA.analyzed_at)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-4xl font-bold ${scoreColor(scanA.overall_score)}`}>
                {scanA.overall_score}
                <span className="text-lg text-muted-foreground font-normal">/100</span>
              </p>
            </CardContent>
          </Card>

          {/* Sonraki */}
          <Card className={scoreBg(scanB.overall_score)}>
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Sonraki
              </p>
              <CardTitle className="text-sm">{formatDate(scanB.analyzed_at)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-4xl font-bold ${scoreColor(scanB.overall_score)}`}>
                {scanB.overall_score}
                <span className="text-lg text-muted-foreground font-normal">/100</span>
                <DiffBadge diff={overallDiff} />
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Kategori Detay Tablosu */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kategori Skorları</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {/* Tablo başlık */}
              <div className="grid grid-cols-4 gap-4 pb-2 border-b text-xs text-muted-foreground uppercase tracking-wider">
                <span>Kategori</span>
                <span className="text-center">Önceki</span>
                <span className="text-center">Sonraki</span>
                <span className="text-center">Fark</span>
              </div>

              {allCategories.map((key) => {
                const scoreA = scanA.category_scores?.[key] ?? 0;
                const scoreB = scanB.category_scores?.[key] ?? 0;
                const diff = scoreB - scoreA;

                return (
                  <div
                    key={key}
                    className="grid grid-cols-4 gap-4 py-3 border-b last:border-b-0"
                  >
                    <span className="text-sm font-medium">
                      {categoryLabels[key] || key}
                    </span>
                    <span
                      className={`text-sm text-center font-semibold ${scoreColor(
                        scoreA
                      )}`}
                    >
                      {scoreA}
                    </span>
                    <span
                      className={`text-sm text-center font-semibold ${scoreColor(
                        scoreB
                      )}`}
                    >
                      {scoreB}
                    </span>
                    <span className="text-center">
                      <DiffBadge diff={diff} />
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Özet */}
        <div className="mt-6 p-4 rounded-lg bg-muted/30 text-sm">
          {overallDiff > 0 ? (
            <p>
              Genel skor <strong className="text-green-600">+{overallDiff} puan</strong>{" "}
              artmış. İyileştirmeler etkisini gösteriyor.
            </p>
          ) : overallDiff < 0 ? (
            <p>
              Genel skor <strong className="text-red-600">{overallDiff} puan</strong>{" "}
              düşmüş. Değişiklikleri gözden geçirmek faydalı olabilir.
            </p>
          ) : (
            <p>Genel skor değişmemiş.</p>
          )}
        </div>
      </div>
    </main>
  );
}
