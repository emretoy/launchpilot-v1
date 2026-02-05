import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side (okuma için — eski uyumluluk, server tarafında kullanılır)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Browser client (auth cookie desteği ile — client component'larda kullan)
export function getBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Server-side (yazma için — service role key ile RLS bypass)
export function getServiceSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey);
}
