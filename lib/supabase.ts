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
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
