import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const INITIAL_ADMIN_USERNAME = process.env.INITIAL_ADMIN_USERNAME?.trim();
const INITIAL_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required');
}

if (!INITIAL_ADMIN_USERNAME || !INITIAL_ADMIN_PASSWORD) {
  throw new Error('INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD are required');
}

if (INITIAL_ADMIN_PASSWORD.length < 12) {
  throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 12 characters');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const passwordHash = await bcrypt.hash(INITIAL_ADMIN_PASSWORD, 12);

const { error } = await supabase.from('users').upsert(
  {
    username: INITIAL_ADMIN_USERNAME,
    name: INITIAL_ADMIN_USERNAME,
    password_hash: passwordHash,
    role: 'Patron',
    is_active: true
  },
  { onConflict: 'username' }
);

if (error) throw error;

console.log(`Compte initial pret: ${INITIAL_ADMIN_USERNAME}`);
