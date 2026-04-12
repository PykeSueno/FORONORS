import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

export type AppUser = {
  id: string;
  username: string;
  password_hash: string;
  role: string | null;
  is_active: boolean;
  created_at: string;
};

export function getSupabaseAdmin() {
  return createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SECRET_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
