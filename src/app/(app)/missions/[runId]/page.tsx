import { notFound } from 'next/navigation';
import { loadRun, MissionError } from '@/lib/missions/runtime';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { RunClient } from './run-client';

export default async function MissionRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  await requireOnboardingStep(user.id, 'home');

  try {
    const { run, mission, turns } = await loadRun(user.id, runId);
    return (
      <section className="space-y-6 pt-6">
        <h1 className="text-2xl font-semibold">{mission.title}</h1>
        <RunClient
          runId={run.id}
          objective={mission.objective}
          turnLimit={mission.turnLimit}
          initialStatus={run.status}
          initialTurns={turns.map((t) => ({
            role: t.role as 'user' | 'assistant',
            content: t.content,
            correction: t.correction,
          }))}
        />
      </section>
    );
  } catch (err) {
    if (err instanceof MissionError) notFound();
    throw err;
  }
}
