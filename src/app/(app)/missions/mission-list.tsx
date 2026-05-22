'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type MissionCard = {
  id: string;
  title: string;
  cefr: string;
  objective: string;
  status: 'none' | 'in_progress' | 'success' | 'incomplete';
};

const STATUS_LABEL: Record<MissionCard['status'], string> = {
  none: 'Jamais faite',
  in_progress: 'En cours',
  success: 'Réussie',
  incomplete: 'À retravailler',
};

export function MissionList({ missions }: { missions: MissionCard[] }) {
  const router = useRouter();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(missionId: string) {
    if (startingId) return;
    setStartingId(missionId);
    setError(null);
    try {
      const res = await fetch('/api/missions/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (!res.ok) throw new Error('network');
      const data = (await res.json()) as { runId: string };
      router.push(`/missions/${data.runId}`);
    } catch {
      setError('Petit souci au lancement. Réessaie.');
      setStartingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {missions.map((m) => (
          <div
            key={m.id}
            className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{m.title}</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {m.cefr}
              </span>
            </div>
            <p className="text-sm text-gray-600">{m.objective}</p>
            <span className="text-xs text-gray-400">{STATUS_LABEL[m.status]}</span>
            <Button disabled={startingId === m.id} onClick={() => void start(m.id)}>
              {startingId === m.id ? 'Démarrage…' : 'Démarrer'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
