'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type LoginResult, loginAction } from './actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(
    loginAction,
    null,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Se connecter</h1>
      <form action={formAction} className="space-y-4">
        <label htmlFor="email" className="block">
          <span className="text-sm text-gray-700">Email</span>
          <Input id="email" type="email" name="email" required autoComplete="email" />
        </label>
        <label htmlFor="password" className="block">
          <span className="text-sm text-gray-700">Mot de passe</span>
          <Input
            id="password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
      <p className="text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
