-- LaunchPilot v1 UX Yeniden Tasarım — Supabase Migration'ları
-- Bu dosyayı Supabase Dashboard > SQL Editor'da çalıştırın

-- Migration 1: scans tablosuna result_json kolonu ekle
ALTER TABLE scans ADD COLUMN IF NOT EXISTS result_json JSONB;

-- Migration 2: tasks tablosu oluştur
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  how_to TEXT NOT NULL,
  effort TEXT NOT NULL CHECK (effort IN ('Kolay','Orta','Zor')),
  recommendation_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','verified','regressed')),
  completed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  scan_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, domain, recommendation_key)
);

-- RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Mevcut policy varsa silme, yoksa oluştur
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Users see own tasks'
  ) THEN
    CREATE POLICY "Users see own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Users update own tasks'
  ) THEN
    CREATE POLICY "Users update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'Service inserts tasks'
  ) THEN
    CREATE POLICY "Service inserts tasks" ON tasks FOR INSERT WITH CHECK (true);
  END IF;
END
$$;
