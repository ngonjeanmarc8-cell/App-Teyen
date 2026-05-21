import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ProfileForm } from './profile-form';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'profile');

  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Personnalise ton parcours</h1>
        <p className="text-gray-700">
          Dis-nous ce que tu veux maîtriser pour qu'on adapte les exercices et les conversations.
        </p>
      </div>
      <ProfileForm />
    </section>
  );
}
