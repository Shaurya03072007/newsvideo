-- ==============================================================================
-- PRAJA VANI: Fix for Supabase Authentication Trigger
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Fix the handle_new_user() function to properly cast 'reporter' to user_role enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_name TEXT;
  v_telugu_name TEXT;
  v_avatar TEXT;
BEGIN
  v_username := COALESCE(
    split_part(NEW.email, '@', 1),
    'user_' || substr(NEW.id::text, 1, 8)
  );

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  v_telugu_name := COALESCE(
    NEW.raw_user_meta_data->>'displayNameTelugu',
    NEW.raw_user_meta_data->>'name',
    v_name || ' (జర్నలిస్ట్)'
  );

  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || v_username
  );

  INSERT INTO public.users (
    id,
    username,
    email,
    password_hash,
    display_name,
    display_name_telugu,
    role,
    district,
    bureau,
    avatar_url,
    google_id,
    active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id::text,
    v_username,
    NEW.email,
    '',
    v_name,
    v_telugu_name,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'reporter'::user_role),
    COALESCE(NEW.raw_user_meta_data->>'district', 'ఎన్టీఆర్ జిల్లా'),
    COALESCE(NEW.raw_user_meta_data->>'bureau', 'విజయవాడ ప్రధాన కార్యాలయం'),
    v_avatar,
    COALESCE(NEW.raw_user_meta_data->>'sub', NEW.id::text),
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    google_id = COALESCE(EXCLUDED.google_id, public.users.google_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify
SELECT 'Trigger public.handle_new_user() updated successfully with user_role cast!' AS status;
