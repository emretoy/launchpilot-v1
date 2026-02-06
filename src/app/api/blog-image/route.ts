import { NextResponse } from "next/server";
import { buildImagePrompt, callImageGen } from "@/lib/blog-generator";

export async function POST(req: Request) {
  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) {
    return NextResponse.json({ error: "KIE_API_KEY eksik", imageUrl: null }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { description, tone, industry } = body as {
      description: string;
      tone: string;
      industry: string | null;
    };

    if (!description) {
      return NextResponse.json({ error: "Görsel açıklaması gerekli", imageUrl: null }, { status: 400 });
    }

    const prompt = buildImagePrompt(description, tone || "pratik", industry);
    const imageUrl = await callImageGen(prompt, kieKey);

    if (!imageUrl) {
      return NextResponse.json({ error: "Görsel oluşturulamadı", imageUrl: null });
    }

    return NextResponse.json({ imageUrl, error: null, _prompt: prompt });
  } catch (err) {
    console.error("Blog image error:", err);
    return NextResponse.json({ error: "Görsel üretilemedi", imageUrl: null }, { status: 500 });
  }
}
