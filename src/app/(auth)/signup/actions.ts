'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SignupResult = { ok: false; error: string };

export async function signupAction(
  _prev: SignupResult | null,
  formData: FormData,
): Promise<SignupResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { ok: false, error: 'Email et mot de passe requis.' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Le mot de passe doit faire au moins 8 caractères.' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  redirect('/home');
}
