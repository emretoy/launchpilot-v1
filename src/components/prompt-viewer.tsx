"use client";

import { useState, useMemo } from "react";

interface Props {
  label: string;
  prompt: string | { template: string; context: string };
}

// Tüm prompt türlerinden site verisini ayır
// Her prompt farklı pattern kullanıyor — hepsini yakalamaya çalış
const DATA_START_PATTERNS = [
  "\nSite: ",              // DNA Gemini/ChatGPT
  "\nSİTE DNA:",           // Blog konu tarama
  "\nSİTE BAĞLAMI",        // Blog yazım + Teknik sağlık
  "\nSİTE: ",              // Format tavsiye
  "\nTEKNİK VERİLER:",     // Teknik sağlık (alternatif)
  "\nHAM VERİLER",         // Konu tarama ham veri
];

const DATA_END_PATTERNS = [
  "\nJSON döndür",         // DNA
  "\nSadece JSON",         // ChatGPT DNA
  "\nGÖREV",              // Blog konu tarama + blog yazım
  "\nKONU:",               // Format tavsiye
  "\nYAZIM KURALLARI",     // Teknik sağlık
  "\nSEO KILAVUZU",        // Teknik sağlık (alternatif)
  "\nFORMAT ŞABLONU",      // Blog yazım
  "\n═══",                 // Bölüm ayırıcı (genel)
];

function splitPromptString(raw: string): { template: string; context: string | null } {
  // İlk eşleşen data-start pattern'ını bul
  let startIdx = -1;
  for (const pat of DATA_START_PATTERNS) {
    const idx = raw.indexOf(pat);
    if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
      startIdx = idx;
    }
  }
  if (startIdx === -1) return { template: raw, context: null };

  // Data bölümünün bittiği yeri bul — startIdx'den sonraki ilk end pattern
  let endIdx = -1;
  for (const pat of DATA_END_PATTERNS) {
    const idx = raw.indexOf(pat, startIdx + 1);
    if (idx !== -1 && idx > startIdx && (endIdx === -1 || idx < endIdx)) {
      endIdx = idx;
    }
  }
  if (endIdx === -1 || endIdx <= startIdx) return { template: raw, context: null };

  const before = raw.substring(0, startIdx).trimEnd();
  const siteData = raw.substring(startIdx + 1, endIdx).trim();
  const after = raw.substring(endIdx + 1).trimStart();

  if (!siteData) return { template: raw, context: null };

  const template = before + "\n\n[SİTE VERİSİ BURAYA EKLENİR]\n\n" + after;
  return { template, context: siteData };
}

export function PromptViewer({ label, prompt }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const { templateText, contextText, fullText } = useMemo(() => {
    if (!prompt) return { templateText: "", contextText: null, fullText: "" };

    if (typeof prompt === "object") {
      return {
        templateText: prompt.template,
        contextText: prompt.context || null,
        fullText: `${prompt.template}\n\n--- Site Verisi ---\n${prompt.context}`,
      };
    }

    // Eski string format — otomatik ayırmayı dene
    const { template, context } = splitPromptString(prompt);
    return {
      templateText: template,
      contextText: context,
      fullText: prompt,
    };
  }, [prompt]);

  if (!prompt) return null;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <span>🔧 {label}</span>
        <span className="text-[10px]">{open ? "▲ Kapat" : "▼ Göster"}</span>
      </button>
      {open && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end gap-3 px-3 pt-2">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(fullText);
                } catch {
                  // Fallback: textarea ile kopyala
                  const ta = document.createElement("textarea");
                  ta.value = fullText;
                  ta.style.position = "fixed";
                  ta.style.opacity = "0";
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  document.body.removeChild(ta);
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-[10px] text-blue-500 hover:text-blue-700 cursor-pointer"
            >
              {copied ? "Kopyalandı!" : "Tümünü Kopyala"}
            </button>
          </div>
          <pre className="px-3 pb-2 text-[11px] leading-relaxed text-gray-600 whitespace-pre-wrap max-h-[300px] overflow-y-auto font-mono">
            {templateText}
          </pre>
          {contextText && (
            <div className="border-t border-gray-200 mx-3 mb-3">
              <button
                onClick={() => setShowContext(!showContext)}
                className="w-full flex items-center justify-between py-1.5 text-[10px] text-gray-400 hover:text-gray-500 cursor-pointer"
              >
                <span>📋 Gönderilen Site Verisi</span>
                <span>{showContext ? "▲ Gizle" : "▼ Göster"}</span>
              </button>
              {showContext && (
                <pre className="text-[10px] leading-relaxed text-gray-400 whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono pb-1">
                  {contextText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
