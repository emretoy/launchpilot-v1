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

// PATCH: Konu statusını güncelle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, planned_date } = body;

    const validStatuses = ["suggested", "planned", "writing", "published", "rejected"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Geçersiz status değeri." }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const updateData: Record<string, unknown> = { status };
    if (planned_date !== undefined) {
      updateData.planned_date = planned_date;
    }

    const { data, error } = await supabase
      .from("blog_topics")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Blog topic update error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Konu güncellenemedi." },
      { status: 500 }
    );
  }
}
