import { NextResponse } from "next/server";
import {
  buildBlogPrompt,
  callGemini,
  parseImagePlaceholders,
  parseTitleAndMeta,
  humanizeHtml,
} from "@/lib/blog-generator";
import type { BlogGenerateRequest } from "@/lib/blog-generator";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key eksik" }, { status: 500 });
  }

  try {
    const body = (await req.json()) as BlogGenerateRequest;

    if (!body.topic || !body.format || !body.siteContext) {
      return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    }

    const prompt = buildBlogPrompt(body);
    const maxTokens =
      body.targetLength <= 1200 ? 2048 : body.targetLength <= 2000 ? 4096 : 8192;

    const raw = await callGemini(prompt, apiKey, {
      temperature: 0.8,
      maxOutputTokens: maxTokens,
      timeoutMs: 30000,
    });

    if (!raw) {
      return NextResponse.json({ error: "Blog metni üretilemedi" }, { status: 500 });
    }

    // Parse title & meta
    const { title, metaDesc } = parseTitleAndMeta(raw);

    // Parse image placeholders
    const imageDescriptions = parseImagePlaceholders(raw);

    // Humanize HTML
    const blogHtml = humanizeHtml(raw);

    // SEO checklist
    const seoChecklist = [
      "Deneyim kutularını kendi sözlerinizle doldurun",
      "Başlık 60 karakterden kısa mı?",
      "Meta description 155 karakterden kısa mı?",
      "Görselleri sitenize yükleyin",
      "En az 3 internal link ekleyin",
      "Yazar bilginizi ekleyin",
    ];

    // Format label
    const formatLabels: Record<string, string> = {
      "problem-solution": "Adım Adım Rehber",
      pillar: "Kapsamlı Kılavuz",
      "case-study": "Başarı Hikayesi",
      comparison: "Karşılaştırma",
      checklist: "Kontrol Listesi",
      faq: "Soru-Cevap",
    };

    return NextResponse.json({
      blogHtml,
      imageDescriptions,
      seoChecklist,
      suggestedTitle: title,
      suggestedMetaDesc: metaDesc,
      chosenFormat: formatLabels[body.format] || body.format,
      error: null,
    });
  } catch (err) {
    console.error("Blog generate error:", err);
    return NextResponse.json({ error: "Blog üretilemedi" }, { status: 500 });
  }
}
