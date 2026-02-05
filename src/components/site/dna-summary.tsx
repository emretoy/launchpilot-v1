"use client";

import type { WebsiteDNA } from "@/lib/types";
import { getDNASummaryLine } from "@/components/shared/dna-components";

export function DNASummary({ dna }: { dna: WebsiteDNA }) {
  const line = getDNASummaryLine(dna);

  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
      <span className="text-lg">🧬</span>
      <p className="text-sm text-indigo-900 font-medium">{line}</p>
    </div>
  );
}
