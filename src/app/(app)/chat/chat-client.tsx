'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type HistoryMsg = { role: 'user' | 'assistant'; content: string };
type Msg = HistoryMsg & { id: string };

export function ChatClient({ initialHistory }: { initialHistory: HistoryMsg[] }) {
  const [messages, setMessages] = useState<Msg[]>(() =>
    initialHistory.map((m) => ({ ...m, id: crypto.randomUUID() })),
  );
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft('');
    setError(null);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: text }]);
    setPending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as { reply: string };
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'assistant', content: data.reply },
      ]);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col gap-4">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-md border border-gray-200 bg-white p-4">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">Dis bonjour à ton tuteur pour commencer.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user' ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
        {pending && <p className="text-sm text-gray-400">Le tuteur réfléchit…</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

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
          placeholder="Écris ton message en anglais…"
          aria-label="Message"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || draft.trim().length === 0}>
          Envoyer
        </Button>
      </form>
    </div>
  );
}
