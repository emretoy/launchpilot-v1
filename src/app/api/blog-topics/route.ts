import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase";
import { scanBlogTopics } from "@/lib/blog-topic-scanner";
import type { BlogTopicScanRequest } from "@/lib/types";

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await authClient.auth.getUser(token);
  return user?.id ?? null;
}

// POST: Konu taraması başlat
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BlogTopicScanRequest = await request.json();

    if (!body.domain || !body.industry || !body.siteType) {
      return NextResponse.json(
        { error: "domain, industry ve siteType zorunlu." },
        { status: 400 }
      );
    }

    // Taramayı çalıştır
    const result = await scanBlogTopics(body);

    // Sonuçları Supabase'e kaydet — chunk halinde (tek seferde hata olursa kısmen kurtulsun)
    const supabase = getServiceSupabase();
    const scanId = crypto.randomUUID();
    let insertedCount = 0;

    if (result.topics.length > 0) {
      const BATCH_SIZE = 20;

      for (let i = 0; i < result.topics.length; i += BATCH_SIZE) {
        const batch = result.topics.slice(i, i + BATCH_SIZE);
        const rows = batch.map((t) => ({
          user_id: userId,
          domain: body.domain,
          title: t.title,
          description: t.description,
          source: t.source,
          source_detail: t.source_detail,
          relevance_score: t.relevance_score,
          difficulty: t.difficulty,
          search_volume: t.search_volume,
          category: t.category,
          keywords: t.keywords,
          suggested_format: t.suggested_format,
          status: "suggested",
          scan_id: scanId,
        }));

        const { error: insertError } = await supabase
          .from("blog_topics")
          .insert(rows);

        if (insertError) {
          console.error(`Supabase insert error (batch ${i / BATCH_SIZE + 1}):`, insertError.message);
          // Hatalı batch'i tek tek dene — hangi satır sorunlu bulsun
          for (const row of rows) {
            const { error: singleError } = await supabase
              .from("blog_topics")
              .insert(row);
            if (!singleError) {
              insertedCount++;
            } else {
              console.error("Row insert failed:", singleError.message, "→", row.title);
            }
          }
        } else {
          insertedCount += batch.length;
        }
      }

      console.log(`Supabase: ${insertedCount}/${result.topics.length} konu kaydedildi.`);
    }

    // Supabase'den güncel verileri çek (ID'ler dahil)
    const { data: savedTopics } = await supabase
      .from("blog_topics")
      .select("*")
      .eq("user_id", userId)
      .eq("domain", body.domain)
      .eq("scan_id", scanId)
      .order("relevance_score", { ascending: false });

    return NextResponse.json({
      topics: savedTopics && savedTopics.length > 0 ? savedTopics : result.topics,
      sourceStats: result.sourceStats,
      scanDuration: result.scanDuration,
      persisted: insertedCount > 0,
    });
  } catch (err) {
    console.error("Blog topic scan error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Konu taraması başarısız oldu." },
      { status: 500 }
    );
  }
}

// GET: Mevcut konuları getir
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    if (!domain) {
      return NextResponse.json({ error: "domain parametresi zorunlu." }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from("blog_topics")
      .select("*")
      .eq("user_id", userId)
      .eq("domain", domain)
      .neq("status", "rejected")
      .order("relevance_score", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Blog topics GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Konular yüklenemedi." },
      { status: 500 }
    );
  }
}
