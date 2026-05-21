import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PlacementClient } from './placement-client';

export default async function PlacementPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'placement');

  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Situons ton niveau</h1>
        <p className="text-gray-700">
          Quelques questions rapides pour estimer ton niveau d'anglais. Réponds du mieux que tu peux
          ; il n'y a pas d'échec, ça nous sert juste à personnaliser ton parcours.
        </p>
      </div>
      <PlacementClient />
    </section>
  );
}
