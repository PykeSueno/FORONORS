import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const username = 'pyke';
const plainPassword = 'santa';
const role = 'super_admin';

const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
if (existingUser) {
  console.log('Admin already exists.');
  process.exit(0);
}

const passwordHash = await bcrypt.hash(plainPassword, 10);

const { error } = await supabase.from('users').insert({
  username,
  password_hash: passwordHash,
  role,
  is_active: true,
});

if (error) {
  throw error;
}

console.log('Admin pyke created successfully.');
