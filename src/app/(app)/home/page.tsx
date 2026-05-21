import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';
import { Button } from '@/components/ui/button';
import { db } from '@/db';
import { skillLevels } from '@/db/schema';
import { levelToLabel } from '@/lib/cefr';
import type { Skill } from '@/lib/exercises/types';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const SKILL_LABELS: Record<Skill, string> = {
  reading: 'Compréhension écrite',
  writing: 'Expression écrite',
  vocab: 'Vocabulaire',
  grammar: 'Grammaire',
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  const levels = user
    ? await db.select().from(skillLevels).where(eq(skillLevels.userId, user.id))
    : [];

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Bienvenue sur Teyen</h1>
      <p className="text-gray-700">
        Connecté en tant que <strong>{user?.email}</strong>.
      </p>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Tes niveaux estimés</h2>
        <ul className="grid grid-cols-2 gap-2">
          {levels.map((l) => (
            <li key={l.id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
              <span className="text-gray-600">{SKILL_LABELS[l.skill as Skill]}</span>
              <span className="ml-2 font-semibold">{levelToLabel(Number(l.cefrEstimate))}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          Estimations initiales — elles s'affineront au fil de tes exercices. Le tuteur arrive
          bientôt.
        </p>
      </div>

      <Link href="/practice">
        <Button>Commencer une session de pratique</Button>
      </Link>

      <LogoutButton />
    </section>
  );
}
