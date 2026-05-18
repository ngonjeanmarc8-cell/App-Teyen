'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from './ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleLogout() {
    start(async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" disabled={pending} onClick={handleLogout}>
      {pending ? 'Déconnexion…' : 'Se déconnecter'}
    </Button>
  );
}
