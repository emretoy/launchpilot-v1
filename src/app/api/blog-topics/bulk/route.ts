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

// PATCH: Bulk topic update
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates array zorunlu." }, { status: 400 });
    }

    const validStatuses = ["suggested", "planned", "writing", "published", "rejected"];
    const supabase = getServiceSupabase();
    let successCount = 0;

    // Her update'i sırayla çalıştır (Supabase bulk update desteklemiyor)
    for (const upd of updates) {
      if (!upd.id || !upd.status || !validStatuses.includes(upd.status)) continue;

      const updateData: Record<string, unknown> = { status: upd.status };
      if (upd.planned_date !== undefined) {
        updateData.planned_date = upd.planned_date;
      }

      const { error } = await supabase
        .from("blog_topics")
        .update(updateData)
        .eq("id", upd.id)
        .eq("user_id", userId);

      if (!error) successCount++;
    }

    return NextResponse.json({ success: true, updated: successCount });
  } catch (err) {
    console.error("Bulk topic update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Toplu güncelleme başarısız." },
      { status: 500 }
    );
  }
}
