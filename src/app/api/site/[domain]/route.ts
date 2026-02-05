import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { domain } = await params;
    const decodedDomain = decodeURIComponent(domain);
    const supabase = getServiceSupabase();

    // Son scan'ı çek (result_json kolonu yoksa fallback)
    let scan: { id: string; result_json: unknown; analyzed_at: string; duration: number } | null = null;
    try {
      const { data: scanData, error: scanError } = await supabase
        .from("scans")
        .select("id, result_json, analyzed_at, duration")
        .eq("domain", decodedDomain)
        .eq("user_id", userId)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .single();

      if (!scanError) {
        scan = scanData;
      } else if (scanError.code !== "PGRST116") {
        // result_json kolonu yoksa, onsuz dene
        const { data: fallback } = await supabase
          .from("scans")
          .select("id, analyzed_at, duration")
          .eq("domain", decodedDomain)
          .eq("user_id", userId)
          .order("analyzed_at", { ascending: false })
          .limit(1)
          .single();
        if (fallback) {
          scan = { ...fallback, result_json: null };
        }
      }
    } catch {
      // scan çekme hatası — devam et
    }

    // Tasks çek (tablo yoksa boş dön)
    let tasks: unknown[] = [];
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("domain", decodedDomain)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (!tasksError) {
        tasks = tasksData || [];
      } else {
        console.error("Tasks fetch error (table may not exist):", tasksError.message);
      }
    } catch {
      // tasks tablosu henüz oluşturulmamış olabilir
    }

    return NextResponse.json({
      scan: scan
        ? {
            id: scan.id,
            result_json: scan.result_json,
            analyzed_at: scan.analyzed_at,
            duration: scan.duration,
          }
        : null,
      tasks: tasks || [],
    });
  } catch (err) {
    console.error("Site data fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 }
    );
  }
}
