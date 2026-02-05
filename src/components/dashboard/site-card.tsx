"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SiteCardProps {
  domain: string;
  url: string;
  overallScore: number | null;
  pendingTasks: number;
  completedTasks: number;
  totalTasks: number;
  lastScanAt: string | null;
  onScan: (url: string) => void;
  onRemove: () => void;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} saat önce`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "dün";
  return `${diffD} gün önce`;
}

export function SiteCard({
  domain,
  url,
  overallScore,
  pendingTasks,
  completedTasks,
  totalTasks,
  lastScanAt,
  onScan,
  onRemove,
}: SiteCardProps) {
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
              className="w-4 h-4 rounded"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <p className="font-medium truncate">{domain}</p>
            {overallScore !== null && (
              <span className={`text-sm font-bold ${scoreColor(overallScore)}`}>
                {overallScore}
              </span>
            )}
          </div>

          {lastScanAt && (
            <p className="text-xs text-muted-foreground mt-1">Son tarama: {timeAgo(lastScanAt)}</p>
          )}

          {/* Task progress */}
          {totalTasks > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>{completedTasks}/{totalTasks} görev</span>
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
          {totalTasks === 0 && !lastScanAt && (
            <p className="text-xs text-muted-foreground mt-1">Henüz taranmadı</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Link href={`/site/${encodeURIComponent(domain)}`}>
            <Button size="sm" variant="outline" className="text-xs h-7">Gör</Button>
          </Link>
          <Button size="sm" className="text-xs h-7" onClick={() => onScan(url)}>Tara</Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            ✕
          </Button>
        </div>
      </div>
    </Card>
  );
}
