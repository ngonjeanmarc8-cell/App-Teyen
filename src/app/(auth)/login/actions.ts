'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LoginResult = { ok: false; error: string };

export async function loginAction(
  _prev: LoginResult | null,
  formData: FormData,
): Promise<LoginResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Email et mot de passe requis.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: 'Identifiants invalides.' };
  }

  redirect('/home');
}
