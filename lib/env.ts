export type RequiredEnvKey = 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY' | 'SESSION_SECRET';

export function getEnv(name: RequiredEnvKey) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env variable: ${name}`);
  }
  return value;
}
