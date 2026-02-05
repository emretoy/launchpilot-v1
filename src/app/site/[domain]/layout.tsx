"use client";

import { use } from "react";
import { SiteProvider } from "@/components/site/site-context";
import { SiteHeader } from "@/components/site/site-header";
import { CategorySidebar } from "@/components/site/category-sidebar";

export default function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);
  const decodedDomain = decodeURIComponent(domain);

  return (
    <SiteProvider domain={decodedDomain}>
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <div className="flex flex-1">
          <CategorySidebar />
          <main className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SiteProvider>
  );
}
