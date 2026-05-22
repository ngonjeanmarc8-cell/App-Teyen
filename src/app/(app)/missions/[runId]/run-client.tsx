'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Turn = { id: string; role: 'user' | 'assistant'; content: string; correction: string | null };
type Status = 'in_progress' | 'success' | 'incomplete';

export function RunClient({
  runId,
  objective,
  turnLimit,
  initialStatus,
  initialTurns,
}: {
  runId: string;
  objective: string;
  turnLimit: number;
  initialStatus: Status;
  initialTurns: { role: 'user' | 'assistant'; content: string; correction: string | null }[];
}) {
  const [turns, setTurns] = useState<Turn[]>(() =>
    initialTurns.map((t) => ({ ...t, id: crypto.randomUUID() })),
  );
  const [status, setStatus] = useState<Status>(initialStatus);
  const [turnsLeft, setTurnsLeft] = useState<number>(
    turnLimit - initialTurns.filter((t) => t.role === 'user').length,
  );
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || pending || status !== 'in_progress') return;
    setDraft('');
    setError(null);
    setTurns((t) => [
      ...t,
      { id: crypto.randomUUID(), role: 'user', content: text, correction: null },
    ]);
    setPending(true);
    try {
      const res = await fetch('/api/missions/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, message: text }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as {
        reply: string;
        correction: string | null;
        status: Status;
        turnsLeft: number;
      };
      setTurns((t) => [
        ...t,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          correction: data.correction,
        },
      ]);
      setStatus(data.status);
      setTurnsLeft(data.turnsLeft);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-gray-100 p-3 text-sm">
        <span className="font-medium">Objectif :</span> {objective}
        {status === 'in_progress' && (
          <span className="ml-2 text-gray-500">· {turnsLeft} tour(s) restant(s)</span>
        )}
      </div>

      <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
        {turns.map((t) => (
          <div key={t.id} className={t.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                t.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {t.content}
            </span>
            {t.correction && <p className="mt-1 text-xs text-amber-700">✍️ {t.correction}</p>}
          </div>
        ))}
        {pending && <p className="text-sm text-gray-400">…</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {status === 'in_progress' ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ta réponse en anglais…"
            aria-label="Réponse"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || draft.trim().length === 0}>
            Envoyer
          </Button>
        </form>
      ) : (
        <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
          <p className={`font-medium ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
            {status === 'success' ? '🎉 Mission réussie !' : 'Mission à retravailler.'}
          </p>
          <div className="flex gap-2">
            <Link href="/missions">
              <Button variant="ghost">Retour aux missions</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
