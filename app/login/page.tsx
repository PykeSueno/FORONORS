import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { LoginPageClient } from '@/components/auth/login-page-client';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/dashboard');
  return <LoginPageClient />;
}
