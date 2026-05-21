'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DOMAINS } from '@/lib/profile/constants';
import { type ProfileResult, saveProfileAction } from './actions';

export function ProfileForm() {
  const [state, formAction, pending] = useActionState<ProfileResult | null, FormData>(
    saveProfileAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-800">
          Quels domaines veux-tu maîtriser ?
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DOMAINS.map((d) => (
            <label key={d.code} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="domains" value={d.code} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="interests" className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">
          Centres d'intérêt (séparés par des virgules)
        </span>
        <Input id="interests" type="text" name="interests" placeholder="films, sport, cuisine" />
      </label>

      <label htmlFor="goalText" className="block space-y-1">
        <span className="text-sm font-medium text-gray-800">Ton objectif (optionnel)</span>
        <textarea
          id="goalText"
          name="goalText"
          maxLength={500}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          placeholder="Ex : passer le TOEFL, manager une équipe internationale…"
        />
      </label>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Enregistrement…' : 'Terminer'}
      </Button>
    </form>
  );
}
