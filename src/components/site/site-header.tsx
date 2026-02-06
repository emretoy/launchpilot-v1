"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthButton } from "@/components/auth-button";
import { useSiteContext } from "./site-context";

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

export function SiteHeader() {
  const router = useRouter();
  const { domain, data, loading, rescan } = useSiteContext();

  const favicon = data?.crawl.basicInfo.favicon;
  const analyzedAt = data?.analyzedAt;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => router.push("/dashboard")}
        >
          ← Dashboard
        </Button>

        <div className="flex items-center gap-2">
          {favicon && (
            <img
              src={favicon}
              alt=""
              className="w-5 h-5 rounded"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <span className="font-semibold text-sm">{domain}</span>
        </div>

        {analyzedAt && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Son tarama: {timeAgo(analyzedAt)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push("/blog-yaz")}
        >
          Blog
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={rescan}
          disabled={loading}
        >
          {loading ? "Taranıyor..." : data ? "Yeniden Tara" : "Siteyi Tara"}
        </Button>
        <AuthButton />
      </div>
    </header>
  );
}
