"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  suggestTopics,
  scoreBlog,
  BLOG_FORMAT_OPTIONS,
} from "@/lib/blog-generator";
import type {
  BlogSiteContext,
  BlogRecommendation,
  BlogContentType,
  BlogGenerateResult,
  ImagePlaceholder,
  BlogScore,
} from "@/lib/blog-generator";

// ── Types ──

type Step = "topic" | "recommend" | "result";

interface Props {
  siteContext: BlogSiteContext;
  initialTopic?: string;
}

// ── Main Component ──

export function BlogGenerator({ siteContext, initialTopic }: Props) {
  const [step, setStep] = useState<Step>("topic");
  const [topic, setTopic] = useState("");
  const [recommendation, setRecommendation] = useState<BlogRecommendation | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<BlogContentType | null>(null);
  const [selectedLength, setSelectedLength] = useState<number>(1500);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [result, setResult] = useState<BlogGenerateResult | null>(null);
  const [blogScore, setBlogScore] = useState<BlogScore | null>(null);
  const [loadingRecommend, setLoadingRecommend] = useState(false);
  const [loadingText, setLoadingText] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageStatuses, setImageStatuses] = useState<("pending" | "done" | "error")[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const htmlRef = useRef<string>("");

  const suggestedTopics = suggestTopics(siteContext);

  // initialTopic değiştiğinde topic'i güncelle
  useEffect(() => {
    if (initialTopic && initialTopic !== topic) {
      setTopic(initialTopic);
      setStep("topic");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic]);

  // ── Handlers ──

  async function handleGetRecommendation() {
    if (!topic.trim()) return;
    setLoadingRecommend(true);
    setError(null);

    try {
      const res = await fetch("/api/blog-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), siteContext }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Tavsiye alınamadı");
      }

      const rec: BlogRecommendation = await res.json();
      setRecommendation(rec);
      setSelectedFormat(rec.recommendedFormat);
      setSelectedLength(rec.recommendedLength);
      setStep("recommend");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setLoadingRecommend(false);
    }
  }

  const handleGenerate = useCallback(async () => {
    if (!selectedFormat || !topic.trim()) return;
    setLoadingText(true);
    setLoadingImages(false);
    setError(null);
    setResult(null);
    setBlogScore(null);
    setImageStatuses([]);
    setCheckedItems(new Set());

    try {
      // ── Stage 1: Metin üret ──
      const textRes = await fetch("/api/blog-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          format: selectedFormat,
          targetLength: selectedLength,
          siteContext,
        }),
      });

      if (!textRes.ok) {
        const data = await textRes.json();
        throw new Error(data.error || "Blog üretilemedi");
      }

      const blogResult: BlogGenerateResult = await textRes.json();
      if (blogResult.error) throw new Error(blogResult.error);

      // Görselleri spinner placeholder'a çevir
      let displayHtml = blogResult.blogHtml;
      const placeholders = blogResult.imageDescriptions;

      for (let i = 0; i < placeholders.length; i++) {
        const p = placeholders[i];
        const re = new RegExp(
          `<!-- IMAGE: ${escapeRegex(p.description)}[^>]*-->`,
          "g"
        );
        displayHtml = displayHtml.replace(
          re,
          `<div id="blog-img-${i}" style="width:100%;aspect-ratio:16/9;background:#f3f4f6;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:20px 0;border:2px dashed #d1d5db;">
            <div style="text-align:center;color:#9ca3af;">
              <div style="font-size:28px;margin-bottom:8px;animation:spin 1s linear infinite;">&#9881;</div>
              <div style="font-size:13px;">Görsel yükleniyor...</div>
              <div style="font-size:11px;margin-top:4px;max-width:280px;">${p.description}</div>
            </div>
          </div>`
        );
      }

      htmlRef.current = displayHtml;
      blogResult.blogHtml = displayHtml;
      setResult({ ...blogResult });
      setStep("result");
      setLoadingText(false);

      // Score — görselsiz halini skorla
      const score = scoreBlog(displayHtml);
      setBlogScore(score);

      // Scroll
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);

      // ── Stage 2: Görselleri arka planda üret ──
      if (placeholders.length > 0) {
        setLoadingImages(true);
        setImageStatuses(new Array(placeholders.length).fill("pending"));

        await generateImagesProgressive(
          placeholders,
          siteContext.industry,
          (idx, base64) => {
            // Her görsel hazır oldukça HTML'e yerleştir
            const imgTag = `<img src="data:image/png;base64,${base64}" alt="${placeholders[idx].description}" style="width:100%;max-width:800px;height:auto;border-radius:12px;margin:20px 0;" />`;
            const placeholderDiv = new RegExp(
              `<div id="blog-img-${idx}"[\\s\\S]*?<\\/div>\\s*<\\/div>`,
              "g"
            );
            htmlRef.current = htmlRef.current.replace(placeholderDiv, imgTag);

            setResult((prev) =>
              prev ? { ...prev, blogHtml: htmlRef.current } : prev
            );
            setImageStatuses((prev) => {
              const next = [...prev];
              next[idx] = "done";
              return next;
            });
          },
          (idx) => {
            // Hata — placeholder'ı "yüklenemedi" olarak güncelle
            const failDiv = `<div style="width:100%;aspect-ratio:16/9;background:#fef2f2;border-radius:12px;display:flex;align-items:center;justify-content:center;margin:20px 0;border:2px dashed #fca5a5;">
              <div style="text-align:center;color:#ef4444;">
                <div style="font-size:24px;margin-bottom:8px;">&#10060;</div>
                <div style="font-size:13px;">Görsel yüklenemedi</div>
                <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Kendi görselinizi ekleyebilirsiniz</div>
              </div>
            </div>`;
            const placeholderDiv = new RegExp(
              `<div id="blog-img-${idx}"[\\s\\S]*?<\\/div>\\s*<\\/div>`,
              "g"
            );
            htmlRef.current = htmlRef.current.replace(placeholderDiv, failDiv);

            setResult((prev) =>
              prev ? { ...prev, blogHtml: htmlRef.current } : prev
            );
            setImageStatuses((prev) => {
              const next = [...prev];
              next[idx] = "error";
              return next;
            });
          }
        );

        setLoadingImages(false);

        // Re-score with images
        const finalScore = scoreBlog(htmlRef.current);
        setBlogScore(finalScore);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
      setLoadingText(false);
      setLoadingImages(false);
    }
  }, [selectedFormat, selectedLength, siteContext, topic]);

  async function handleCopyHtml() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(htmlRef.current || result.blogHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = htmlRef.current || result.blogHtml;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownloadImages() {
    const html = htmlRef.current || result?.blogHtml || "";
    const imgRegex = /src="data:image\/png;base64,([^"]+)"/g;
    let match;
    let idx = 1;
    while ((match = imgRegex.exec(html)) !== null) {
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${match[1]}`;
      link.download = `blog-gorsel-${idx}.png`;
      link.click();
      idx++;
    }
  }

  function handleReset() {
    setStep("topic");
    setTopic("");
    setRecommendation(null);
    setSelectedFormat(null);
    setSelectedLength(1500);
    setShowFormatPicker(false);
    setResult(null);
    setBlogScore(null);
    setLoadingText(false);
    setLoadingImages(false);
    setImageStatuses([]);
    setError(null);
    setCheckedItems(new Set());
    setCopied(false);
    htmlRef.current = "";
  }

  function toggleCheck(idx: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  // ── Image status summary ──
  const doneCount = imageStatuses.filter((s) => s === "done").length;
  const totalImages = imageStatuses.length;

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Bir sorun oluştu</p>
          <p className="text-sm mt-1">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setError(null)}>
            Tekrar Dene
          </Button>
        </div>
      )}

      {/* ═══ STEP 1: TOPIC ═══ */}
      {(step === "topic" || step === "recommend") && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Ne hakkında yazmak istiyorsunuz?
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Örn: Kıvırcık saçlar için bakım önerileri"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGetRecommendation(); }}
                  className="flex-1"
                />
                <Button onClick={handleGetRecommendation} disabled={!topic.trim() || loadingRecommend}>
                  {loadingRecommend ? (
                    <span className="flex items-center gap-2"><Spinner /> Analiz ediliyor...</span>
                  ) : "Tavsiye Al"}
                </Button>
              </div>
            </div>

            {suggestedTopics.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Sitenize özel konu önerileri:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTopics.map((t, i) => (
                    <button key={i} onClick={() => setTopic(t)}
                      className="px-3 py-1.5 text-sm rounded-full border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ STEP 2: RECOMMENDATION ═══ */}
      {step === "recommend" && recommendation && (
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg shrink-0">AI</div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Önerilen format:</p>
                  <p className="text-xl font-bold text-gray-900">{recommendation.formatLabel}</p>
                </div>
                <div className="space-y-1">
                  {recommendation.reasons.map((r, i) => (
                    <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>{r}
                    </p>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">~{recommendation.recommendedLength} kelime</Badge>
                  <span className="text-gray-500">{recommendation.lengthReason}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleGenerate}>
                Tamam, Yaz!
              </Button>
              <Button variant="outline" onClick={() => setShowFormatPicker(!showFormatPicker)}>
                {showFormatPicker ? "Kapat" : "Farklı format seçmek istiyorum"}
              </Button>
            </div>

            {showFormatPicker && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {BLOG_FORMAT_OPTIONS.map((opt) => (
                  <button key={opt.value}
                    onClick={() => { setSelectedFormat(opt.value); setShowFormatPicker(false); }}
                    className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedFormat === opt.value ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"
                    }`}>
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.description}</p>
                  </button>
                ))}
                <div className="sm:col-span-2 pt-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Uzunluk:</p>
                  <div className="flex gap-2">
                    {[
                      { label: "Kısa (~800)", value: 800 },
                      { label: "Orta (~1500)", value: 1500 },
                      { label: "Uzun (~2500)", value: 2500 },
                    ].map((opt) => (
                      <button key={opt.value} onClick={() => setSelectedLength(opt.value)}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer ${
                          selectedLength === opt.value ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleGenerate}>
                    Bu formatla yaz!
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ TEXT LOADING (spinner + sonra hemen result göster) ═══ */}
      {loadingText && (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Spinner size="lg" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Blog yazınız hazırlanıyor...</p>
                <p className="text-sm text-gray-500">AI konunuzu analiz edip yazıyı oluşturuyor. Birkaç saniye sürecek.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ RESULT (metin gelince hemen görünür, görseller teker teker yerleşir) ═══ */}
      {step === "result" && result && (
        <div ref={resultRef} className="space-y-6">

          {/* Görsel yüklenme durumu */}
          {loadingImages && totalImages > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <Spinner />
              <p className="text-sm text-blue-800">
                Görseller oluşturuluyor: {doneCount}/{totalImages} tamamlandı
              </p>
              <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${totalImages > 0 ? (doneCount / totalImages) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Blog Score */}
          {blogScore && (
            <Card className={`${
              blogScore.level === "green" ? "border-green-200 bg-green-50"
                : blogScore.level === "yellow" ? "border-yellow-200 bg-yellow-50"
                : "border-red-200 bg-red-50"
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl">
                    {blogScore.level === "green" ? "\u{1F7E2}" : blogScore.level === "yellow" ? "\u{1F7E1}" : "\u{1F534}"}
                  </div>
                  <div>
                    <p className="text-xl font-bold">{blogScore.total}/100 — {blogScore.levelLabel}</p>
                    <p className="text-sm text-gray-600">{blogScore.levelMessage}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {blogScore.criteria.map((c, i) => (
                    <div key={i} title={c.detail}
                      className={`text-center p-2 rounded-lg ${c.passed ? "bg-white/70" : "bg-white/50 border border-dashed border-gray-300"}`}>
                      <p className="text-xs text-gray-500">{c.label}</p>
                      <p className={`text-sm font-bold ${c.passed ? "text-green-600" : "text-gray-400"}`}>{c.score}/{c.maxScore}</p>
                    </div>
                  ))}
                </div>
                {blogScore.criteria.filter((c) => !c.passed).length > 0 && (
                  <div className="mt-4 space-y-1">
                    <p className="text-sm font-medium text-gray-700">İyileştirme önerileri:</p>
                    {blogScore.criteria.filter((c) => !c.passed).map((c, i) => (
                      <p key={i} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-amber-500 shrink-0">&#9679;</span>
                        <span><strong>{c.label}:</strong> {c.detail}</span>
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Title & Meta */}
          {(result.suggestedTitle || result.suggestedMetaDesc) && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="font-medium text-gray-800">SEO Önerileri</p>
                {result.suggestedTitle && (
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">Title</Badge>
                    <p className="text-sm text-gray-700 flex-1">{result.suggestedTitle}</p>
                    <CopyButton text={result.suggestedTitle} />
                  </div>
                )}
                {result.suggestedMetaDesc && (
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0">Meta</Badge>
                    <p className="text-sm text-gray-700 flex-1">{result.suggestedMetaDesc}</p>
                    <CopyButton text={result.suggestedMetaDesc} />
                  </div>
                )}
                <p className="text-xs text-gray-400">Format: {result.chosenFormat}</p>
              </CardContent>
            </Card>
          )}

          {/* ═══ BLOG HTML PREVIEW ═══ */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="font-medium text-gray-800">Blog Önizleme</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadImages}
                    disabled={loadingImages || doneCount === 0}>
                    Görselleri İndir
                  </Button>
                  <Button size="sm" onClick={handleCopyHtml}>
                    {copied ? "Kopyalandı!" : "HTML Kopyala"}
                  </Button>
                </div>
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div
                className="prose prose-gray max-w-none border rounded-lg p-6 bg-white
                  prose-h1:text-2xl prose-h1:font-bold prose-h1:text-gray-900 prose-h1:mb-4
                  prose-h2:text-xl prose-h2:font-semibold prose-h2:text-gray-800 prose-h2:mt-8 prose-h2:mb-3
                  prose-h3:text-lg prose-h3:font-medium prose-h3:text-gray-700 prose-h3:mt-6 prose-h3:mb-2
                  prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                  prose-li:text-gray-700
                  prose-strong:text-gray-900
                  prose-blockquote:border-l-4 prose-blockquote:border-green-300 prose-blockquote:bg-green-50 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg
                  prose-table:border-collapse prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-2 prose-th:border prose-th:border-gray-200 prose-th:px-3 prose-th:py-2 prose-th:bg-gray-50"
                dangerouslySetInnerHTML={{ __html: result.blogHtml }}
              />
            </CardContent>
          </Card>

          {/* SEO Checklist */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="font-medium text-gray-800">SEO Kontrol Listesi</p>
              {result.seoChecklist.map((item, i) => (
                <label key={i} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={checkedItems.has(i)} onChange={() => toggleCheck(i)} className="w-4 h-4 rounded border-gray-300" />
                  <span className={checkedItems.has(i) ? "line-through text-gray-400" : ""}>{item}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleCopyHtml}>
              {copied ? "Kopyalandı!" : "HTML Kopyala"}
            </Button>
            <Button variant="outline" onClick={handleReset}>Yeni Blog Yaz</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ──

function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const s = size === "lg" ? "w-7 h-7" : "w-4 h-4";
  return (
    <svg className={`animate-spin ${s} text-blue-500`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }} className="text-xs text-blue-600 hover:text-blue-800 shrink-0 cursor-pointer">
      {copied ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}

// ── Helpers ──

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function generateImagesProgressive(
  placeholders: ImagePlaceholder[],
  industry: string | null,
  onImageReady: (idx: number, base64: string) => void,
  onImageError: (idx: number) => void
): Promise<void> {
  // Paralel ama max 2 concurrent (API'yi boğmamak için)
  const batchSize = 2;
  for (let i = 0; i < placeholders.length; i += batchSize) {
    const batch = placeholders.slice(i, i + batchSize);
    const promises = batch.map(async (p, batchIdx) => {
      const idx = i + batchIdx;
      try {
        const res = await fetch("/api/blog-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: p.description,
            tone: p.tone,
            industry,
          }),
        });
        const data = await res.json();
        if (data.imageBase64) {
          onImageReady(idx, data.imageBase64);
        } else {
          onImageError(idx);
        }
      } catch {
        onImageError(idx);
      }
    });
    await Promise.all(promises);
  }
}
