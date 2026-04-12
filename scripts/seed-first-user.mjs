import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
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
