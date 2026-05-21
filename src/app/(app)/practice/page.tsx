import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PracticeClient } from './practice-client';

export default async function PracticePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Pratique</h1>
      <p className="text-gray-700">
        Des exercices choisis pour toi selon ton niveau. Réponds, lis l'explication, continue.
      </p>
      <PracticeClient />
    </section>
  );
}
