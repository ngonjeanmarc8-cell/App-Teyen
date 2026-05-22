'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const SKILLS = ['reading', 'writing', 'vocab', 'grammar'] as const;
type Skill = (typeof SKILLS)[number];

const SKILL_LABELS: Record<Skill, string> = {
  reading: 'Compréhension écrite',
  writing: 'Expression écrite',
  vocab: 'Vocabulaire',
  grammar: 'Grammaire',
};

type Item = {
  exerciseId: string;
  passage: string | null;
  prompt: string;
  options: string[];
  skill: string;
};

type Feedback = { correct: boolean; correctIndex: number; rationale: string };

export function PracticeClient() {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNext(targetSkill: Skill) {
    setLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch('/api/practice/next', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skill: targetSkill }),
      });
      if (!res.ok) throw new Error('network');
      setItem((await res.json()) as Item);
    } catch {
      setError('Petit souci de chargement. Réessaie.');
    } finally {
      setLoading(false);
    }
  }

  function chooseSkill(target: Skill) {
    if (target === skill && (item || loading)) return;
    setSkill(target);
    setItem(null);
    void loadNext(target);
  }

  async function answer(selectedIndex: number) {
    if (!item || feedback || loading) return;
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

  // No category chosen yet: show the picker.
  if (!skill) {
    return (
      <div className="space-y-4">
        <p className="text-gray-700">Choisis ce que tu veux pratiquer :</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SKILLS.map((s) => (
            <Button
              key={s}
              variant="ghost"
              className="justify-start border border-gray-200"
              onClick={() => chooseSkill(s)}
            >
              {SKILL_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {SKILLS.map((s) => (
          <Button
            key={s}
            variant="ghost"
            aria-current={s === skill ? 'page' : undefined}
            disabled={loading}
            className={`border ${s === skill ? 'border-black font-semibold' : 'border-gray-200 text-gray-500'}`}
            onClick={() => chooseSkill(s)}
          >
            {SKILL_LABELS[s]}
          </Button>
        ))}
      </div>

      {error && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
          <Button onClick={() => void loadNext(skill)}>Réessayer</Button>
        </div>
      )}

      {loading && !item && <p className="text-gray-600">Chargement…</p>}

      {item && (
        <div className="space-y-6">
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
              <Button onClick={() => void loadNext(skill)}>Question suivante</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
