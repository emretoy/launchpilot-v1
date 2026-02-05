"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UrlInput } from "@/components/url-input";
import { AuthButton } from "@/components/auth-button";

const features = [
  { name: "Performance", desc: "PageSpeed & Core Web Vitals" },
  { name: "SEO & Content", desc: "Meta tags, headings, sitemap" },
  { name: "Security", desc: "SSL, security headers, Safe Browsing" },
  { name: "Technology", desc: "Tech stack, best practices, a11y" },
  { name: "Online Presence", desc: "Google index, social profiles" },
  { name: "Authority", desc: "SEO, GEO, AEO, Backlink, Blog" },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // URL param yoksa ve login ise dashboard'a yönlendir
    if (!loading && user) {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("url")) {
        router.push("/dashboard");
      }
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen flex flex-col items-center px-4">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4">
        <span className="text-lg font-bold tracking-tight">LaunchPilot</span>
        <AuthButton />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center space-y-6 max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Analyze Your Website
          </h1>
          <p className="text-lg text-muted-foreground">
            Get a complete website audit in seconds. Performance, SEO, security,
            technology stack — all in one place.
          </p>
          <UrlInput />
        </div>

        {/* Features */}
        <div className="mt-16 max-w-3xl w-full">
          <h2 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider mb-6">
            What We Analyze
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {features.map((feat) => (
              <div
                key={feat.name}
                className="text-center p-4 rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium">{feat.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
