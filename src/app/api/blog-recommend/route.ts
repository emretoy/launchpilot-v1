import { NextResponse } from "next/server";
import { buildRecommendPrompt, callGemini } from "@/lib/blog-generator";
import type { BlogSiteContext } from "@/lib/blog-generator";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key eksik" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { topic, siteContext, topicData } = body as {
      topic: string;
      siteContext: BlogSiteContext;
      topicData?: Record<string, unknown>;
    };

    if (!topic || !siteContext) {
      return NextResponse.json({ error: "Konu ve site bilgisi gerekli" }, { status: 400 });
    }

    const prompt = buildRecommendPrompt(topic, siteContext, topicData);
    const raw = await callGemini(prompt, apiKey, {
      temperature: 0.8,
      maxOutputTokens: 1024,
      timeoutMs: 10000,
    });

    if (!raw) {
      return NextResponse.json({ error: "AI tavsiyesi alınamadı" }, { status: 500 });
    }

    // JSON parse — Gemini bazen markdown code fence ekliyor
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const recommendation = JSON.parse(cleaned);

    return NextResponse.json({ ...recommendation, _prompt: prompt });
  } catch (err) {
    console.error("Blog recommend error:", err);
    return NextResponse.json({ error: "Tavsiye oluşturulamadı" }, { status: 500 });
  }
}
