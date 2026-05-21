'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Item = {
  exerciseId: string;
  passage: string | null;
  prompt: string;
  options: string[];
  skill: string;
};

type Feedback = { correct: boolean; correctIndex: number; rationale: string };

const SKILL_LABELS: Record<string, string> = {
  reading: 'Compréhension écrite',
  writing: 'Expression écrite',
  vocab: 'Vocabulaire',
  grammar: 'Grammaire',
};

export function PracticeClient() {
  const [item, setItem] = useState<Item | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadNext() {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/practice/next', { method: 'POST' });
      if (!res.ok) throw new Error('network');
      setItem((await res.json()) as Item);
    } catch {
      setError('Petit souci de chargement. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: load the first exercise once on mount
  useEffect(() => {
    void loadNext();
  }, []);

  async function answer(selectedIndex: number) {
    if (!item || feedback) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/practice/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exerciseId: item.exerciseId, selectedIndex }),
      });
      if (!res.ok) throw new Error('network');
      setFeedback((await res.json()) as Feedback);
    } catch {
      setError('Petit souci. Réessaie.');
    } finally {
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

  if (loading && !item) {
    return <p className="text-gray-600">Chargement…</p>;
  }

  if (!item) {
    return <p className="text-gray-600">Chargement…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-xs uppercase tracking-wide text-gray-400">
        {SKILL_LABELS[item.skill] ?? item.skill}
      </p>
      {item.passage && <p className="rounded-md bg-gray-100 p-4 text-sm">{item.passage}</p>}
      <p className="font-medium">{item.prompt}</p>
      <div className="grid gap-2">
        {item.options.map((opt, i) => {
          const isCorrect = feedback && i === feedback.correctIndex;
          const tone = feedback
            ? isCorrect
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200'
            : 'border-gray-200';
          return (
            <Button
              key={opt}
              variant="ghost"
              className={`justify-start border ${tone}`}
              disabled={loading || feedback !== null}
              onClick={() => void answer(i)}
            >
              {opt}
            </Button>
          );
        })}
      </div>
      {feedback && (
        <div className="space-y-3">
          <p
            className={`text-sm font-medium ${feedback.correct ? 'text-green-700' : 'text-red-600'}`}
          >
            {feedback.correct ? 'Correct !' : 'Pas tout à fait.'}
          </p>
          <p className="text-sm text-gray-700">{feedback.rationale}</p>
          <Button onClick={() => void loadNext()}>Question suivante</Button>
        </div>
      )}
    </div>
  );
}
