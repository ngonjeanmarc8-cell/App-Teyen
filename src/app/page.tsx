import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-4xl font-bold">Teyen</h1>
      <p className="max-w-md text-gray-700">
        Apprends l'anglais jusqu'au niveau C2 avec un tuteur IA qui s'adapte à toi.
      </p>
      <div className="flex gap-3">
        <Link href="/signup">
          <Button>Commencer</Button>
        </Link>
        <Link href="/login">
          <Button variant="ghost">Se connecter</Button>
        </Link>
      </div>
    </main>
  );
}
