import { NextResponse } from "next/server";
import { buildImagePrompt, callImagen } from "@/lib/blog-generator";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key eksik", imageBase64: null }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { description, tone, industry } = body as {
      description: string;
      tone: string;
      industry: string | null;
    };

    if (!description) {
      return NextResponse.json({ error: "Görsel açıklaması gerekli", imageBase64: null }, { status: 400 });
    }

    const prompt = buildImagePrompt(description, tone || "pratik", industry);
    const imageBase64 = await callImagen(prompt, apiKey);

    if (!imageBase64) {
      return NextResponse.json({ error: "Görsel oluşturulamadı", imageBase64: null });
    }

    return NextResponse.json({ imageBase64, error: null });
  } catch (err) {
    console.error("Blog image error:", err);
    return NextResponse.json({ error: "Görsel üretilemedi", imageBase64: null }, { status: 500 });
  }
}
