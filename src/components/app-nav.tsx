'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/home', label: 'Accueil' },
  { href: '/practice', label: 'Pratique' },
  { href: '/missions', label: 'Missions' },
  { href: '/chat', label: 'Tuteur' },
] as const;

export function AppNav() {
  const pathname = usePathname();

  // No mode navigation during onboarding (placement / profile).
  if (pathname.startsWith('/onboarding')) return null;

  return (
    <nav className="flex items-center gap-4 text-sm">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={active ? 'font-semibold text-black' : 'text-gray-500 hover:text-black'}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
