import { loadFullHistory } from '@/lib/chat/persistence';
import { requireOnboardingStep } from '@/lib/onboarding/gate';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ChatClient } from './chat-client';

export default async function ChatPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await requireOnboardingStep(user.id, 'home');

  const history = user ? await loadFullHistory(user.id) : [];

  return (
    <section className="space-y-6 pt-6">
      <h1 className="text-2xl font-semibold">Ton tuteur</h1>
      <ChatClient initialHistory={history} />
    </section>
  );
}
