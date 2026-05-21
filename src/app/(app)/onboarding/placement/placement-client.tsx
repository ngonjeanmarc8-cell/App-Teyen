'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Item = {
  done: boolean;
  exerciseId?: string;
  passage?: string | null;
  prompt?: string;
  options?: string[];
  slotIndex?: number;
  total?: number;
};

export function PlacementClient() {
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNext() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/placement/next', { method: 'POST' });
      if (!res.ok) throw new Error('network');
      const data: Item = await res.json();
      if (data.done) {
        router.push('/onboarding/profile');
        router.refresh();
        return;
      }
      setItem(data);
    } catch {
      setError('Petit souci de chargement. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load the first item once on mount
  useEffect(() => {
    void loadNext();
  }, []);

  async function answer(selectedIndex: number) {
    if (!item?.exerciseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/placement/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exerciseId: item.exerciseId, selectedIndex }),
      });
      if (!res.ok) throw new Error('network');
      await loadNext();
    } catch {
      setError('Petit souci. Réessaie.');
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
        <Button onClick={() => void loadNext()}>Réessayer</Button>
      </div>
    );
  }

  if (loading || !item || !item.options) {
    return <p className="text-gray-600">Chargement…</p>;
  }

  const progress = (item.slotIndex ?? 0) + 1;
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Question {progress} / {item.total ?? 12}
      </p>
      {item.passage && <p className="rounded-md bg-gray-100 p-4 text-sm">{item.passage}</p>}
      <p className="font-medium">{item.prompt}</p>
      <div className="grid gap-2">
        {item.options.map((opt, i) => (
          <Button
            key={opt}
            variant="ghost"
            className="justify-start"
            onClick={() => void answer(i)}
          >
            {opt}
          </Button>
        ))}
      </div>
    </div>
  );
}
