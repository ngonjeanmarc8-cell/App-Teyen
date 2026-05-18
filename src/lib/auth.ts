import { createSupabaseServerClient } from './supabase/server';

export type AuthedUser = { id: string; email: string };

export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    throw new UnauthorizedError();
  }
  return { id: user.id, email: user.email };
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}
