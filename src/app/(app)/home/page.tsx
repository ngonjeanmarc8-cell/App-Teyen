import { LogoutButton } from '@/components/logout-button';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Bienvenue sur Teyen</h1>
      <p className="text-gray-700">
        Connecté en tant que <strong>{user?.email}</strong>. Le test de placement et le tuteur
        arrivent dans les prochaines versions.
      </p>
      <LogoutButton />
    </section>
  );
}
