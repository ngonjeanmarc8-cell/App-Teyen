import { ALL_MISSIONS } from '@/lib/missions/catalog';
import { statusByMission } from '@/lib/missions/runtime';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { MissionList } from './mission-list';

export default async function MissionsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  const statuses = user ? await statusByMission(user.id) : {};
  const missions = ALL_MISSIONS.map((m) => ({
    id: m.id,
    title: m.title,
    cefr: m.cefr,
    objective: m.objective,
    status: (statuses[m.id] ?? 'none') as 'none' | 'in_progress' | 'success' | 'incomplete',
  }));

  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Missions</h1>
        <p className="text-gray-700">
          Choisis une situation à jouer. Atteins l'objectif avant la fin des tours.
        </p>
      </div>
      <MissionList missions={missions} />
    </section>
  );
}
