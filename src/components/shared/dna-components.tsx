"use client";

import { Badge } from "@/components/ui/badge";
import { PromptViewer } from "@/components/prompt-viewer";
import type { WebsiteDNA } from "@/lib/types";

export const siteTypeLabels: Record<string, string> = {
  "e-commerce": "E-Ticaret", blog: "Blog", corporate: "Kurumsal", saas: "SaaS",
  portfolio: "Portfolyo", "landing-page": "Landing Page", forum: "Forum",
  news: "Haber", directory: "Rehber", education: "Eğitim", unknown: "Belirsiz",
};

export const maturityLabels: Record<string, string> = {
  newborn: "Yeni Doğmuş", young: "Genç", growing: "Büyüyen", mature: "Olgun", veteran: "Kıdemli",
};

export const scaleLabels: Record<string, string> = {
  "single-page": "Tek Sayfa", small: "Küçük", medium: "Orta", large: "Büyük", enterprise: "Kurumsal",
};

const audienceLabels: Record<string, string> = {
  B2B: "B2B (İşletmeler)", B2C: "B2C (Tüketiciler)", both: "B2B + B2C", unknown: "Belirsiz",
};

const marketLabels: Record<string, string> = {
  local: "Yerel", national: "Ulusal", global: "Global", unknown: "Belirsiz",
};

const revenueLabels: Record<string, string> = {
  "e-commerce": "E-Ticaret", advertising: "Reklam", saas: "SaaS Abonelik",
  "lead-generation": "Müşteri Adayı", "content-media": "İçerik/Medya",
  "non-profit": "Kar Amacı Gütmeyen", unknown: "Belirsiz",
};

const contactLabels: Record<string, string> = {
  phone: "Telefon", email: "E-posta", form: "Form", chat: "Canlı Sohbet", whatsapp: "WhatsApp",
};

export function DNAMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-3 py-2 bg-white/40 rounded-lg">
      <p className="text-xs text-indigo-600 font-medium">{label}</p>
      <p className="text-sm font-semibold text-indigo-900">{value}</p>
    </div>
  );
}

export function DNADetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/60 rounded-xl border border-indigo-100 p-4">
      <h4 className="text-sm font-semibold text-indigo-800 mb-3">{title}</h4>
      {children}
    </div>
  );
}

export function DNAInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-indigo-50 last:border-0">
      <span className="text-sm text-indigo-600/70">{label}</span>
      <span className="text-sm font-medium text-indigo-900 text-right max-w-[60%]">{value || <span className="text-indigo-300">-</span>}</span>
    </div>
  );
}

export function DNABadge({ children, active = true }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
    }`}>
      {children}
    </span>
  );
}

export function DNABoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-indigo-50 last:border-0">
      <span className="text-sm text-indigo-600/70">{label}</span>
      {value ? (
        <span className="text-green-600 text-sm font-medium">Var</span>
      ) : (
        <span className="text-gray-400 text-sm">Yok</span>
      )}
    </div>
  );
}

/** DNA'dan tek satır özet: "WordPress · E-ticaret · 3 yaşında · Türkiye" */
export function getDNASummaryLine(dna: WebsiteDNA): string {
  // v3: aiAnalysis varsa what_it_does kullan
  if (dna.aiAnalysis?.business_identity.what_it_does) {
    return dna.aiAnalysis.business_identity.what_it_does;
  }
  const parts: string[] = [];
  if (dna.techStack.platform) parts.push(dna.techStack.platform);
  parts.push(siteTypeLabels[dna.identity.siteType] || dna.identity.siteType);
  parts.push(maturityLabels[dna.maturity.level] || dna.maturity.level);
  parts.push(scaleLabels[dna.scale.level] || dna.scale.level);
  if (dna.targetMarket.primaryLanguage) parts.push(dna.targetMarket.primaryLanguage.toUpperCase());
  return parts.join(" · ");
}

export function DNAProfileSection({ dna }: { dna: WebsiteDNA }) {
  const ai = dna.aiAnalysis;

  return (
    <section>
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-cyan-50 border border-indigo-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🧬</span>
          <h2 className="text-xl font-bold text-indigo-900">DNA Profili</h2>
        </div>

        <div className="text-center mb-5">
          <h3 className="text-2xl font-bold text-indigo-900 mb-2">{dna.identity.brandName}</h3>
          {ai && (
            <p className="text-sm text-indigo-700 mb-2 max-w-xl mx-auto">{ai.business_identity.what_it_does}</p>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-sm px-3 py-1">
              {siteTypeLabels[dna.identity.siteType] || dna.identity.siteType}
            </Badge>
            {dna.identity.industry && (
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-sm px-3 py-1">
                {dna.identity.industry}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <DNAMiniStat label="Hedef Kitle" value={audienceLabels[dna.targetMarket.audience] || dna.targetMarket.audience} />
          <DNAMiniStat label="Pazar" value={marketLabels[dna.targetMarket.marketScope] || dna.targetMarket.marketScope} />
          <DNAMiniStat label="Olgunluk" value={`${maturityLabels[dna.maturity.level] || dna.maturity.level} (${dna.maturity.score})`} />
          <DNAMiniStat label="Ölçek" value={`${scaleLabels[dna.scale.level] || dna.scale.level}${dna.scale.estimatedPages ? ` (~${dna.scale.estimatedPages})` : ""}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DNADetailCard title="Teknoloji DNA'sı">
          <DNAInfoRow label="Platform" value={dna.techStack.platform || "Tespit edilemedi"} />
          <DNAInfoRow label="JS Framework" value={dna.techStack.jsFramework || "Tespit edilemedi"} />
          <DNAInfoRow label="Hosting" value={dna.techStack.hosting || "Tespit edilemedi"} />
          <DNAInfoRow label="CDN" value={dna.techStack.cdnProvider || "Tespit edilemedi"} />
          {dna.techStack.marketingTools.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {dna.techStack.marketingTools.map((tool, i) => (
                <DNABadge key={i}>{tool}</DNABadge>
              ))}
            </div>
          )}
        </DNADetailCard>

        <DNADetailCard title="İş Modeli & İletişim">
          <DNAInfoRow label="Gelir Modeli" value={revenueLabels[dna.revenueModel.primary] || dna.revenueModel.primary} />
          <DNAInfoRow
            label="İletişim"
            value={
              dna.contact.methods.length > 0
                ? dna.contact.methods.map(m => contactLabels[m] || m).join(", ")
                : "Tespit edilemedi"
            }
          />
          <DNAInfoRow label="Fiziksel Adres" value={dna.contact.hasPhysicalAddress ? "Var" : "Yok"} />
          {dna.contact.socialPlatforms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {dna.contact.socialPlatforms.map((p, i) => (
                <DNABadge key={i}>{p}</DNABadge>
              ))}
            </div>
          )}
        </DNADetailCard>

        <DNADetailCard title="Hukuki & Güven">
          <DNABoolRow label="Gizlilik Politikası" value={dna.legalTrust.hasPrivacyPolicy} />
          <DNABoolRow label="Kullanım Koşulları" value={dna.legalTrust.hasTerms} />
          <DNABoolRow label="KVKK Uyumu" value={dna.legalTrust.hasKVKK} />
          <DNABoolRow label="Cookie Consent" value={dna.legalTrust.hasCookieConsent} />
          {dna.legalTrust.sslDetails && (
            <DNAInfoRow label="SSL" value={dna.legalTrust.sslDetails} />
          )}
        </DNADetailCard>

        <DNADetailCard title="İçerik Yapısı">
          <DNABoolRow label="Blog" value={dna.contentStructure.hasBlog} />
          <DNABoolRow label="Üyelik Sistemi" value={dna.contentStructure.hasAuth} />
          <DNABoolRow label="Site İçi Arama" value={dna.contentStructure.hasSearch} />
          <DNABoolRow label="Mobil Uygulama" value={dna.contentStructure.hasMobileApp} />
          <DNABoolRow label="Newsletter" value={dna.contentStructure.hasNewsletter} />
          <DNABoolRow label="E-Ticaret" value={dna.contentStructure.hasEcommerce} />
        </DNADetailCard>
      </div>

      {dna._prompts && (
        <div className="space-y-2 mt-4">
          {dna._prompts.gemini && <PromptViewer label="DNA Analiz Prompt'u (Gemini)" prompt={dna._prompts.gemini} />}
          {dna._prompts.chatgpt && <PromptViewer label="DNA Doğrulama Prompt'u (ChatGPT)" prompt={dna._prompts.chatgpt} />}
        </div>
      )}
    </section>
  );
}
