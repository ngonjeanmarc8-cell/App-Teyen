import { PlacementClient } from './placement-client';

export default function PlacementPage() {
  return (
    <section className="space-y-6 pt-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Situons ton niveau</h1>
        <p className="text-gray-700">
          Quelques questions rapides pour estimer ton niveau d'anglais. Réponds du mieux que tu peux
          ; il n'y a pas d'échec, ça nous sert juste à personnaliser ton parcours.
        </p>
      </div>
      <PlacementClient />
    </section>
  );
}
