import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const password_hash = await bcrypt.hash('santa', 12);

const { error } = await supabase.from('users').upsert(
  {
    username: 'pyke',
    password_hash,
    role: 'Patron',
    is_active: true
  },
  { onConflict: 'username' }
);

if (error) {
  throw error;
}

console.log('Compte initial prêt: pyke / santa');
